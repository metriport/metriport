import { MetriportError } from "@metriport/shared";
import { AxiosResponse } from "axios";
import { z } from "zod";

export function validateAndLogResponse<T>({
  url,
  response,
  schema,
  debug,
}: {
  url: string;
  response: AxiosResponse;
  schema: z.ZodSchema<T>;
  debug: typeof console.log;
}): T {
  if (!response.data) throw new MetriportError(`No body returned from ${url}`);
  debug(`${url} resp: `, () => JSON.stringify(response.data));
  return schema.parse(response.data);
}
