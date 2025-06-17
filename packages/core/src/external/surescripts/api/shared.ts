import { MetriportError } from "@metriport/shared";
import { AxiosResponse } from "axios";
import { z } from "zod";

export function validateAndLogResponse<T>({
  url,
  response,
  schema,
  debug,
  display,
}: {
  url: string;
  response: AxiosResponse;
  schema: z.ZodSchema<T>;
  debug: typeof console.log;
  display?: (data: T) => string;
}): T {
  if (!response.data) throw new MetriportError(`No body returned from ${url}`);
  const validatedData = schema.parse(response.data);
  debug(`GET ${url}\n`, () =>
    display ? display(validatedData) : JSON.stringify(validatedData, null, 2)
  );
  return validatedData;
}
