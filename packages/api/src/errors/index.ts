import { out } from "@metriport/core/util";
import { Config } from "../shared/config";
import { errorToString } from "../shared/log";
import { capture } from "../shared/notifications";

export function getErrorMessage(error: unknown) {
  return errorToString(error);
}

/**
 * @deprecated Use @metriport/core/util/error/shared instead
 */
export function processAsyncError(msg: string, useMsgAsTitle = false) {
  const { log } = out("processAsyncError");
  return (error: unknown) => {
    if (Config.isDev()) log(`${msg}:`, error);
    else log(`${msg}: ${getErrorMessage(error)}`);
    capture.error(useMsgAsTitle ? msg : error, { extra: { message: msg, error } });
  };
}
