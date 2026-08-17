declare module 'ali-oss' {
  export interface OSSOptions {
    region?: string;
    endpoint?: string;
    bucket: string;
    accessKeyId: string;
    accessKeySecret: string;
    secure?: boolean;
    timeout?: number | string;
  }

  export interface PutOptions {
    meta?: Record<string, string>;
    timeout?: number;
  }

  export interface ListQuery {
    prefix?: string;
    marker?: string;
    'max-keys'?: number;
    delimiter?: string;
  }

  export interface OSSObject {
    name: string;
    size: number | string;
    lastModified: string | Date;
    etag?: string;
  }

  export interface ListResult {
    objects?: OSSObject[];
    prefixes?: string[];
    isTruncated?: boolean;
    nextMarker?: string;
    res?: Record<string, unknown>;
  }

  export interface HeadResult {
    status: number;
    meta?: Record<string, string>;
    res: { headers: Record<string, string> } & Record<string, unknown>;
  }

  export interface GetResult {
    content: Buffer;
    res: Record<string, unknown>;
  }

  export interface GetStreamResult {
    stream: import('node:http').IncomingMessage;
    res: { status: number; headers: Record<string, string> };
  }

  export default class OSS {
    constructor(options: OSSOptions);
    put(name: string, file: string | Buffer | import('node:stream').Readable, options?: PutOptions): Promise<{ name: string; res: Record<string, unknown> }>;
    get(name: string, options?: Record<string, unknown>): Promise<GetResult>;
    getStream(name: string, options?: Record<string, unknown>): Promise<GetStreamResult>;
    head(name: string, options?: Record<string, unknown>): Promise<HeadResult>;
    delete(name: string, options?: Record<string, unknown>): Promise<{ res: Record<string, unknown> }>;
    list(query?: ListQuery, options?: Record<string, unknown>): Promise<ListResult>;
  }
}
