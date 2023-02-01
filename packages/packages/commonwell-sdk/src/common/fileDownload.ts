import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import * as fs from "fs";
import * as stream from "stream";
import * as util from "util";
const pipeline = util.promisify(stream.pipeline);

export async function downloadFile({
  url,
  outputStream,
  client,
  headers,
}: {
  url: string;
  outputStream: fs.WriteStream;
  client?: AxiosInstance;
  headers?: {
    [index: string]: string;
  };
}): Promise<boolean> {
  const config: AxiosRequestConfig = {
    responseType: "stream",
    validateStatus: null,
    headers,
  };
  const response = await (client ?? axios).get(url, config);
  await pipeline(response.data, outputStream);
  const status = response.status;
  if (status >= 200 && status < 300) return true;

  const msg = `Failed to download, status ${status}: ${response.statusText}`;
  console.log(`${msg}`);
  console.log({ url, headers, client });
  throw new Error(msg);
}
