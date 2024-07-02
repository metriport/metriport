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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function genericErrorToString(err: any): string {
  const msg = "message" in err ? err.message : String(err);
  const code = "code" in err ? err.code : undefined;
  const status = "response" in err ? err.response.status : undefined;
  const suffix =
    code && status ? ` (${code} - ${status})` : code || status ? ` (${code ?? status})` : "";
  return msg + suffix;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function detailedErrorToString(err: any): string {
  const thisErrorMessage = genericErrorToString(err);
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
