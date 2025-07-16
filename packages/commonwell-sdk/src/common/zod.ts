import { z } from "zod";

// Custom Zod oriented functions and schemas to be used in addition to the ones from @metriport/shared

export const emptyStringToUndefinedSchema = z.preprocess(
  emptyStringToUndefined,
  z.string().nullish()
);

/**
 * Note: this can't be used in PATCH endpoints because it will prevent us from identifying whether
 * the field is to be left untouched (undefined) or to be removed (null).
 */
export function emptyStringToUndefined(arg: unknown): unknown {
  if (typeof arg === "string" && ["", "undefined", "null"].includes(arg.trim())) return undefined;
  return arg ?? undefined;
}

export function literalStringToUndefined(arg: unknown): unknown {
  if (typeof arg === "string" && arg.trim().toLocaleLowerCase() === "string") return undefined;
  return arg ?? undefined;
}
