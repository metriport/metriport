import { gzip, gunzip } from "zlib";

export async function compressGzip(content: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    gzip(content, (err: Error | null, result: Buffer) => {
      if (err) reject(err);
      resolve(result);
    });
  });
}

export async function decompressGzip(content: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    gunzip(content, (err: Error | null, result: Buffer) => {
      if (err) reject(err);
      resolve(result);
    });
  });
}
