import { type Message } from "google-protobuf";

declare module "@grpc/grpc-js/build/src/make-client" {
  interface MethodDefinition {
    requestType: new () => Message;
    responseType: new () => Message;
  }
}
