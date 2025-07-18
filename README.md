# grpc-promise-client

Wrapper around `@grpc/grpc-js` client that allows to use promises instead of callbacks.

## Installation

`npm i grpc-promise-client`

## Usage

```typescript
import { credentials } from "@grpc/grpc-js";
import { grpcClientFactory } from "grpc-promise-client";
import { BookServiceClient } from "./book_grpc_pb";

const createGrpcClient = grpcClientFactory({
  defaultAddress: "localhost:50000",
  credentials: credentials.createInsecure(),
});

const bookService = createGrpcClient(BookServiceClient);
const res = await bookService.getBook({ name: "Harry Potter" });
```

## Contributing

Contributions are always welcome!

## License

[Apache-2.0](https://choosealicense.com/licenses/apache-2.0/)
