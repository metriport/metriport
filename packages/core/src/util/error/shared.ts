import { getErrorMessage } from "@metriport/shared/error/shared";
import { out } from "../log";
import { capture } from "../notifications";

export function processAsyncError(msg: string, log?: typeof console.log | undefined) {
  if (!log) log = out().log;
  return (err: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    log!(`${msg}: ${getErrorMessage(err)}`);
    capture.error(err, { extra: { message: msg, err } });
  };
}

export * from "@metriport/shared/error/shared";
