import { BadRequestError, errorToString, NotFoundError } from "@metriport/shared";
import { Config } from "../config";
import { out } from "../log";
import { capture } from "../notifications";
export { detailedErrorToString, errorToString, ErrorToStringOptions } from "@metriport/shared";

/**
 * @deprecated User @metriport/shared instead
 */
export function getErrorMessage(error: unknown) {
  return errorToString(error);
}

export function processAsyncError(
  msg: string,
  log: typeof console.log | undefined = out().log,
  useMsgAsTitle = false
) {
  return (error: unknown) => {
    if (Config.isDev()) {
      log(`${msg}: ${getErrorMessage(error)}`, error);
    } else {
      log(`${msg}: ${getErrorMessage(error)}`);
    }
    if (error instanceof BadRequestError || error instanceof NotFoundError) return;
    capture.error(useMsgAsTitle ? msg : error, { extra: { message: msg, error } });
  };
}
