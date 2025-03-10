import { emptyFunction } from "@metriport/shared";
import { Config } from "./config";
import { getRequestIdSafe } from "./request";

type LogParamBasic = string | number | boolean | unknown | null | undefined;
export type LogParam = LogParamBasic | (() => LogParamBasic);
export type Logger = ReturnType<typeof out>;

export function log(prefix?: string, suffix?: string) {
  return (msg: string, ...optionalParams: LogParam[]): void => {
    const actualPrefix = prefix ? `[${prefix}] ` : ``;

    const reqId = getRequestIdSafe();
    const reqPrefix = reqId ? `${reqId} ` : "";

    const actualParams = (optionalParams ?? []).map(p => (typeof p === "function" ? p() : p));
    return console.log(
      `${reqPrefix}${actualPrefix}${msg}`,
      ...[...actualParams, ...(suffix ? [suffix] : [])]
    );
  };
}

export function debug(prefix?: string, suffix?: string) {
  if (Config.isCloudEnv()) return emptyFunction;
  return log(prefix, suffix);
}

export function out(prefix?: string, suffix?: string) {
  return {
    log: log(prefix, suffix),
    debug: debug(prefix, suffix),
  };
}
