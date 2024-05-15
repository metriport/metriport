import { inspect } from "node:util";

export type ErrorToStringOptions = { detailed: boolean };

export function errorToString(
  err: unknown,
  options: ErrorToStringOptions = { detailed: true }
): string {
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
  // this can lead to multi-line
  const additionalInfo = err.additionalInfo
    ? inspect(err.additionalInfo, { compact: true, breakLength: undefined })
    : undefined;
  const causeMessage = err.cause ? detailedErrorToString(err.cause) : undefined;
  return (
    `${thisErrorMessage}` +
    `${additionalInfo ? ` (${additionalInfo})` : ""}` +
    `${causeMessage ? `; caused by ${causeMessage}` : ""}`
  );
}

export function getErrorMessage(error: unknown) {
  return errorToString(error);
}
