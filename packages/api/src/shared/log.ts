import { inspect } from "node:util";
import { ZodError } from "zod";

type LogParamBasic = string | number | boolean | unknown | null | undefined;
export type LogParam = LogParamBasic | (() => LogParamBasic);

export type ErrorToStringOptions = { detailed: boolean };

/**
 * @deprecated Use @metriport/shared instead
 */
export function errorToString(
  err: unknown,
  options: ErrorToStringOptions = { detailed: true }
): string {
  if (err instanceof ZodError) return Object.values(err.flatten().fieldErrors).join("; ");
  if (options.detailed) {
    return detailedErrorToString(err);
  }
  return genericErrorToString(err);
}

export function genericErrorToString(err: unknown): string {
  return (err as any)["message"] ?? String(err); // eslint-disable-line @typescript-eslint/no-explicit-any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function detailedErrorToString(err: any): string {
  const thisErrorMessage = err.message;
  const additionalInfo = err.additionalInfo ? inspect(err.additionalInfo) : undefined;
  const causeMessage = err.cause ? detailedErrorToString(err.cause) : undefined;
  return (
    `${thisErrorMessage}` +
    `${additionalInfo ? ` (${additionalInfo})` : ""}` +
    `${causeMessage ? `; caused by ${causeMessage}` : ""}`
  );
}
