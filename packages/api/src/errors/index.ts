import { errorToString } from "../shared/log";
import { capture } from "@metriport/core/util/notifications";

export function getErrorMessage(error: unknown) {
  return errorToString(error);
}

export function processAsyncError(msg: string) {
  return (err: unknown) => {
    console.error(`${msg}: ${getErrorMessage(err)}`);
    capture.error(err, { extra: { message: msg } });
  };
}
