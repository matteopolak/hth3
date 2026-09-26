export type D1Value = string | number | null | ArrayBuffer | Uint8Array;

export interface D1Meta {
  changes: number;
  duration: number;
  last_row_id: number;
  rows_read: number;
  rows_written: number;
}

export interface D1Result<Row = unknown> {
  results?: Row[];
  success: boolean;
  meta: D1Meta;
  error?: string;
}

export interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement;
  first<Row = unknown>(columnName?: string): Promise<Row | null>;
  all<Row = unknown>(): Promise<D1Result<Row>>;
  run<Row = unknown>(): Promise<D1Result<Row>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<Row = unknown>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<Row>[]>;
}

export interface R2ObjectBody {
  body: ReadableStream<Uint8Array>;
  httpMetadata?: { contentType?: string };
  size: number;
  etag: string;
  writeHttpMetadata(headers: Headers): void;
}

export interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array> | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<unknown | null>;
  delete(key: string): Promise<void>;
}
