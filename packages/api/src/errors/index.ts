import { capture } from "../shared/notifications";

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function processAsyncError(msg: string) {
  return (err: unknown) => {
    console.error(`${msg}: ${getErrorMessage(err)}`);
    capture.error(err, { extra: { message: msg } });
  };
}
