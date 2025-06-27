import { AxiosResponse } from "axios";
import { z } from "zod";
import { MetriportError } from "../error/metriport-error";

export function parseAndLogAxiosResponse<T>(
  url: string,
  response: AxiosResponse,
  schema: z.ZodSchema<T>,
  debug: typeof console.log
): T {
  if (!response.data) throw new MetriportError(`No body returned from ${url}`);
  debug(`${url} resp: `, () => JSON.stringify(response.data));
  const parsed = schema.parse(response.data);
  return parsed;
}

export function logAxiosResponse(
  url: string,
  response: AxiosResponse,
  debug: typeof console.log
): void {
  debug(`${url} resp: `, () => JSON.stringify(response.data));
}
