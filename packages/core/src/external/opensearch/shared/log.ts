import { emptyFunction } from "@metriport/shared";
import { out } from "../../../util/log";

export type OpenSearchLogLevel = "info" | "debug" | "none";

export function getLog(
  defaultLogger: ReturnType<typeof out>,
  logLevel?: OpenSearchLogLevel | undefined
): ReturnType<typeof out> {
  if (logLevel === "none") return { debug: emptyFunction, log: emptyFunction };
  return {
    debug: logLevel === "debug" ? defaultLogger.debug : emptyFunction,
    log: defaultLogger.log,
  };
}
