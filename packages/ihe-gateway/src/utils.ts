type LogParamBasic = string | number | boolean | unknown | null | undefined;
export type LogParam = LogParamBasic | (() => LogParamBasic);

// From packages/core/src/util/log.ts
export function log(prefix?: string, suffix?: string) {
  return (msg: string, ...optionalParams: LogParam[]): void => {
    const actualPrefix = prefix ? `[${prefix}] ` : ``;
    const actualParams = (optionalParams ?? []).map(p => (typeof p === "function" ? p() : p));
    return console.log(`${actualPrefix}${msg}`, ...[...actualParams, ...(suffix ? [suffix] : [])]);
  };
}

export function sleep(timeInMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeInMs));
}

export const getEnvVar = (varName: string): string | undefined => process.env[varName];

export const getEnvVarOrFail = (varName: string): string => {
  const value = getEnvVar(varName);
  if (!value || value.trim().length < 1) {
    throw new Error(`Missing ${varName} env var`);
  }
  return value;
};
