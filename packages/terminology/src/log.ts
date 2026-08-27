import { AsyncLocalStorage } from "node:async_hooks";

type LogParamBasic = string | number | boolean | unknown | null | undefined;
export type LogParam = LogParamBasic | (() => LogParamBasic);

export const asyncLocalStorage = new AsyncLocalStorage<string>();

export function getRequestIdSafe(): string | undefined {
  return asyncLocalStorage.getStore() ?? undefined;
}

export function log(prefix?: string, suffix?: string): typeof console.log {
  return (msg: string, ...optionalParams: LogParam[]): void => {
    const reqId = getRequestIdSafe();
    const reqPrefix = reqId ? `${reqId} ` : "";
    const actualPrefix = prefix ? `[${prefix}] ` : "";
    const actualParams = (optionalParams ?? []).map(p => (typeof p === "function" ? p() : p));
    return console.log(
      `${reqPrefix}${actualPrefix}${msg}`,
      ...[...actualParams, ...(suffix ? [suffix] : [])]
    );
  };
}

export function out(prefix?: string, suffix?: string) {
  return {
    log: log(prefix, suffix),
  };
}
