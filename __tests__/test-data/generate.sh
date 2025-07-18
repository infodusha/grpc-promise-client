#!/bin/bash

cd ./__tests__/test-data

OUT_DIR=./generated

mkdir -p $OUT_DIR

gen () {
  ../../node_modules/.bin/grpc_tools_node_protoc --js_out="import_style=commonjs,binary:$OUT_DIR" --grpc_out="grpc_js:$OUT_DIR" $1
  ../../node_modules/.bin/grpc_tools_node_protoc --plugin=protoc-gen-ts="../../node_modules/.bin/protoc-gen-ts" --ts_out="grpc_js:$OUT_DIR" $1
  
  echo "Generated $1"
}

gen ./book.proto

