import axios, { AxiosRequestConfig, ResponseType } from "axios";
import * as fs from "fs";
import * as stream from "stream";
import * as util from "util";

const pipeline = util.promisify(stream.pipeline);

type BaseParams = {
  headers?: {
    [index: string]: string;
  };
  timeout?: number;
};

export type DownloadToStreamParams = BaseParams & {
  url: string;
  outputStream: stream.Writable;
};

export type DownloadToMemoryParams = Omit<DownloadToStreamParams, "outputStream">;

export type DownloadToFileParams = Omit<DownloadToStreamParams, "outputStream"> & {
  filePath: string;
};

export async function downloadToStream({
  url,
  outputStream,
  ...configParams
}: DownloadToStreamParams): Promise<boolean> {
  const requestConfig = buildRequestConfig(configParams, "stream");
  const response = await axios.get(url, requestConfig);
  await pipeline(response.data, outputStream);
  return true;
}

export async function downloadToMemory({
  url,
  ...configParams
}: DownloadToMemoryParams): Promise<Buffer> {
  const requestConfig = buildRequestConfig(configParams, "arraybuffer");
  const response = await axios.get(url, requestConfig);
  return await response.data;
}

export async function downloadToFile(params: DownloadToFileParams): Promise<void> {
  const outputStream = fs.createWriteStream(params.filePath);
  await downloadToStream({
    ...params,
    outputStream,
  });
}

function buildRequestConfig(
  { timeout, headers }: BaseParams,
  responseType: ResponseType
): AxiosRequestConfig {
  const requestConfig: AxiosRequestConfig = {
    responseType,
    ...(timeout ? { timeout } : undefined),
    transitional: {
      clarifyTimeoutError: true,
    },
    ...(headers && { headers }),
  };
  return requestConfig;
}
