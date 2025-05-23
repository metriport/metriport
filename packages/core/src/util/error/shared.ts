import { BadRequestError, NotFoundError } from "@metriport/shared";
import { inspect } from "node:util";
import { out } from "../log";
import { capture } from "../notifications";

/**
 * @deprecated User @metriport/shared instead
 */
export type ErrorToStringOptions = { detailed: boolean };

/**
 * @deprecated User @metriport/shared instead
 */
export function errorToString(
  err: unknown,
  options: ErrorToStringOptions = { detailed: true }
): string {
  if (options.detailed) {
    return detailedErrorToString(err);
  }
  return genericErrorToString(err);
}

/**
 * @deprecated User @metriport/shared instead
 */
export function genericErrorToString(err: unknown): string {
  return (err as any)["message"] ?? String(err); // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * @deprecated User @metriport/shared instead
 */
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

/**
 * @deprecated User @metriport/shared instead
 */
export function getErrorMessage(error: unknown) {
  return errorToString(error);
}

export function processAsyncError(
  msg: string,
  log?: typeof console.log | undefined,
  useMsgAsTitle = false
) {
  if (!log) log = out().log;
  return (error: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    log!(`${msg}: ${getErrorMessage(error)}`);
    if (error instanceof BadRequestError || error instanceof NotFoundError) return;
    capture.error(useMsgAsTitle ? msg : error, { extra: { message: msg, error } });
  };
}
