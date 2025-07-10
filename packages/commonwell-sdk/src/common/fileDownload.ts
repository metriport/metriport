import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import * as stream from "stream";
import * as util from "util";

const pipeline = util.promisify(stream.pipeline);

export async function downloadFileInMemory({
  url,
  client,
  responseType,
  headers,
}: {
  url: string;
  client?: AxiosInstance;
  responseType: "arraybuffer";
  headers?: {
    [index: string]: string;
  };
}): Promise<Buffer>;
export async function downloadFileInMemory({
  url,
  client,
  responseType,
  headers,
}: {
  url: string;
  client?: AxiosInstance;
  responseType: "text";
  headers?: {
    [index: string]: string;
  };
}): Promise<string>;
export async function downloadFileInMemory({
  url,
  client,
  responseType,
  headers,
}: {
  url: string;
  client?: AxiosInstance;
  responseType: "json";
  headers?: {
    [index: string]: string;
  };
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any>;
export async function downloadFileInMemory({
  url,
  client,
  responseType,
  headers,
}: {
  url: string;
  client?: AxiosInstance;
  responseType: "arraybuffer" | "json" | "text";
  headers?: {
    [index: string]: string;
  };
}): Promise<Buffer | string> {
  const config: AxiosRequestConfig = {
    ...(headers && { headers }),
    responseType,
  };
  const response = await (client ?? axios).get(url, config);
  return response.data;
}

export async function downloadFileAsStream({
  url,
  outputStream,
  client,
  headers,
}: {
  url: string;
  outputStream: stream.Writable;
  client?: AxiosInstance;
  headers?: {
    [index: string]: string;
  };
}): Promise<boolean> {
  const config: AxiosRequestConfig = {
    responseType: "stream",
    ...(headers && { headers }),
  };
  const response = await (client ?? axios).get(url, config);
  await pipeline(response.data, outputStream);
  return true;
}
