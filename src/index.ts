import { type Message } from "google-protobuf";

import {
  ChannelCredentials,
  type ChannelOptions,
  type ClientUnaryCall,
  Metadata,
  MetadataValue,
  type ServiceClientConstructor,
  type ServiceError,
} from "@grpc/grpc-js";

import { fromProtobufObject } from "from-protobuf-object";

type AnyMeta = Record<string, MetadataValue | null | undefined>;

type GrpcInterceptorNext<
  Req extends Message,
  Res extends Message,
  ReqMeta extends AnyMeta,
  ResMeta extends AnyMeta
> = (req: AsObject<Req>, reqMeta: ReqMeta) => Promise<Result<Res, ResMeta>>;

export type GrpcInterceptor<
  ReqMeta extends AnyMeta,
  ResMeta extends AnyMeta
> = (
  method: string,
  req: AsObject<Message>,
  reqMeta: ReqMeta,
  next: GrpcInterceptorNext<Message, Message, ReqMeta, ResMeta>
) => Promise<Result<Message, ResMeta>>;

export type GrpcMethod<
  Req extends Message,
  Res extends Message,
  ReqMeta extends AnyMeta,
  ResMeta extends AnyMeta
> = (req: AsObject<Req>, reqMeta?: ReqMeta) => Promise<Result<Res, ResMeta>>;

type Result<T extends Message, Meta> = { data: AsObject<T>; metadata?: Meta };

type AsObject<T extends Message> = ReturnType<T["toObject"]>;

type ServiceClientConstructorOnly = new (
  address: string,
  credentials: ChannelCredentials,
  options?: Partial<ChannelOptions>
) => unknown;

type IsMessage<T> = T extends Message ? T : never;

type Request<M> = M extends (
  request: infer R,
  callback: (...args: unknown[]) => void
) => unknown
  ? R
  : never;

type Response<M> = M extends (
  request: never,
  metadata: never,
  options: unknown,
  callback: (err: ServiceError | null, response: infer R) => unknown
) => ClientUnaryCall
  ? R
  : never;

type ExcludeFromGrpcClient =
  | "waitForReady"
  | "close"
  | "getChannel"
  | "makeUnaryRequest"
  | "makeServerStreamRequest"
  | "makeClientStreamRequest"
  | "makeBidiStreamRequest";

type GrpcClient<T, ReqMeta extends AnyMeta, ResMeta extends AnyMeta> = {
  [K in Exclude<keyof T, ExcludeFromGrpcClient>]: GrpcMethod<
    IsMessage<Request<T[K]>>,
    IsMessage<Response<T[K]>>,
    ReqMeta,
    ResMeta
  >;
};

interface GrpcClientFactoryOptions<
  ReqMeta extends AnyMeta,
  ResMeta extends AnyMeta
> {
  defaultAddress: string;
  credentials: ChannelCredentials;
  interceptors?: GrpcInterceptor<ReqMeta, ResMeta>[];
}

export function grpcClientFactory<
  ReqMeta extends AnyMeta,
  ResMeta extends AnyMeta
>(options: GrpcClientFactoryOptions<ReqMeta, ResMeta>) {
  return function createGrpcClient<T extends ServiceClientConstructorOnly>(
    Client: T,
    address = options.defaultAddress
  ): GrpcClient<InstanceType<T>, ReqMeta, ResMeta> {
    const ClientConstructor = Client as unknown as ServiceClientConstructor;
    const client = new ClientConstructor(address, options.credentials);
    const result: Record<
      string,
      GrpcMethod<never, never, AnyMeta, AnyMeta>
    > = {};
    for (const [key, methodDefinition] of Object.entries(
      ClientConstructor.service
    )) {
      const callback = client[key]!.bind(client) as GrpcCallback<
        Message,
        Message
      >;
      result[key] = createGrpcMethod(
        callback,
        methodDefinition.requestType,
        key,
        options as any
      );
    }
    return result as any;
  };
}

type GrpcCallback<Req extends Message, Res extends Message> = (
  request: Req,
  metadata: Metadata,
  callback: (err: ServiceError | null, response: Res) => void
) => ClientUnaryCall;

function createGrpcMethod<Req extends Message, Res extends Message>(
  callback: GrpcCallback<Req, Res>,
  requestType: new () => Req,
  methodName: string,
  options: GrpcClientFactoryOptions<AnyMeta, AnyMeta>
): GrpcMethod<Req, Res, AnyMeta, AnyMeta> {
  return async (req, reqMeta = {}) => {
    function invoke(reqI: AsObject<Req>, reqMetaI: AnyMeta) {
      const request = fromProtobufObject(requestType, reqI);
      return callGrpcCallback(callback, request, reqMetaI);
    }

    const chain = (options.interceptors ?? []).reduceRight<
      GrpcInterceptorNext<Req, Res, AnyMeta, AnyMeta>
    >(
      (next, interceptor) => (reqI, reqMetaI) =>
        interceptor(methodName, reqI, reqMetaI, next) as Promise<
          Result<Res, AnyMeta>
        >,
      invoke
    );

    return chain(req, reqMeta);
  };
}

function callGrpcCallback<Req extends Message, Res extends Message>(
  callback: GrpcCallback<Req, Res>,
  req: Req,
  reqMeta: AnyMeta
): Promise<Result<Res, AnyMeta>> {
  return new Promise((resolve, reject) => {
    const requestMetadata = Object.entries(reqMeta).reduce(
      (acc, [key, value]) => {
        if (value) {
          acc.set(key, value);
        }
        return acc;
      },
      new Metadata()
    );
    let resMeta: AnyMeta = {};
    const surface = callback(
      req,
      requestMetadata,
      (err: ServiceError | null, response: Res) => {
        if (err) {
          surface.removeAllListeners();
          reject(err);
          return;
        }
        const data = response.toObject() as AsObject<Res>;
        resolve({ data, metadata: resMeta });
      }
    ).once("metadata", (responseMetadata: Metadata) => {
      resMeta = responseMetadata.getMap();
    });
  });
}
