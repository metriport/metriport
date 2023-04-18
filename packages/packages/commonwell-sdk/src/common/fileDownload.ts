import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
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
