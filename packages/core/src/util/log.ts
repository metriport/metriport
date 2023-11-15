import { Config } from "./config";

type LogParamBasic = string | number | boolean | unknown | null | undefined;
export type LogParam = LogParamBasic | (() => LogParamBasic);

export function log(prefix?: string, suffix?: string) {
  return (msg: string, ...optionalParams: LogParam[]): void => {
    const actualParams = (optionalParams ?? []).map(p => (typeof p === "function" ? p() : p));
    return console.log(
      `${prefix ? `[${prefix}] ` : ``}${msg}`,
      ...[...actualParams, ...(suffix ? [suffix] : [])]
    );
  };
}

export function debug(prefix: string, suffix?: string) {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  if (Config.isCloudEnv()) return () => {};
  return log(prefix, suffix);
}

export function out(prefix: string, suffix?: string) {
  return {
    log: log(prefix, suffix),
    debug: debug(prefix, suffix),
  };
}
