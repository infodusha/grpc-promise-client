import {
  ClientUnaryCall,
  credentials,
  Metadata,
  ServiceError,
} from "@grpc/grpc-js";
import { grpcClientFactory } from "../src";
import { BookServiceClient } from "./test-data/generated/book_grpc_pb";
import {
  Book,
  GetBookRequest,
  GetBookResponse,
} from "./test-data/generated/book_pb";

function getBookSpy(): jest.SpyInstance<
  ClientUnaryCall,
  [
    GetBookRequest,
    Metadata,
    (err: ServiceError | null, resp: GetBookResponse) => void
  ]
> {
  return jest.spyOn(BookServiceClient.prototype, "getBook") as any;
}

describe("grpcClientFactory", () => {
  it("Should work", async () => {
    const createClient = grpcClientFactory({
      defaultAddress: "localhost:50051",
      credentials: credentials.createInsecure(),
    });

    const spy = getBookSpy();

    const book = new Book();
    book.setName("Harry Potter and the Philosopher's Stone");
    book.setShelf(3);

    spy.mockImplementationOnce((request, metadata, callback) => {
      const response = new GetBookResponse();
      response.setBook(book);
      callback(null, response);
      return {} as ClientUnaryCall;
    });

    const bookService = createClient(BookServiceClient);

    const res = await bookService.getBook({ name: "Harry Potter" });

    expect(res.book).toEqual(book.toObject());
  });

  it("Should run interceptors", async () => {
    const createClient = grpcClientFactory({
      defaultAddress: "localhost:50051",
      credentials: credentials.createInsecure(),
      interceptors: [
        (method, req, reqMeta, next) => {
          expect(method).toBe("getBook");
          expect(req).toEqual({ name: "Heat Wave" });
          expect(reqMeta).toEqual({});
          return next(req, reqMeta);
        },
      ],
    });

    const spy = getBookSpy();

    const book = new Book();
    book.setName("Heat");
    book.setShelf(2);

    spy.mockImplementationOnce((request, metadata, callback) => {
      const response = new GetBookResponse();
      response.setBook(book);
      callback(null, response);
      return {} as ClientUnaryCall;
    });

    const bookService = createClient(BookServiceClient);

    const res = await bookService.getBook({ name: "Heat Wave" });

    expect(res.book).toEqual(book.toObject());
  });
});
