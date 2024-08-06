import { errorToString } from "../shared/log";
import { capture } from "../shared/notifications";

export function getErrorMessage(error: unknown) {
  return errorToString(error);
}

export function processAsyncError(msg: string, useMsgAsTitle = false) {
  return (error: unknown) => {
    console.error(`${msg}: ${getErrorMessage(error)}`);
    capture.error(useMsgAsTitle ? msg : error, { extra: { message: msg, error } });
  };
}
