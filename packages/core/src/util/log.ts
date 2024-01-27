import { emptyFunction } from "@metriport/shared";
import { Config } from "./config";

type LogParamBasic = string | number | boolean | unknown | null | undefined;
export type LogParam = LogParamBasic | (() => LogParamBasic);

export function log(prefix?: string, suffix?: string, systemPrefix?: string) {
  return (msg: string, ...optionalParams: LogParam[]): void => {
    const actualSystemPrefix = systemPrefix ? `${systemPrefix} ` : ``;
    const actualPrefix = prefix ? `[${prefix}] ` : ``;

    const actualParams = (optionalParams ?? []).map(p => (typeof p === "function" ? p() : p));
    return console.log(
      `${actualSystemPrefix}${actualPrefix}${msg}`,
      ...[...actualParams, ...(suffix ? [suffix] : [])]
    );
  };
}

export function debug(prefix: string, suffix?: string) {
  if (Config.isCloudEnv()) return emptyFunction;
  return log(prefix, suffix);
}

export function out(prefix: string, suffix?: string) {
  return {
    log: log(prefix, suffix),
    debug: debug(prefix, suffix),
  };
}
