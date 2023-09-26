export function log(prefix: string, suffix?: string) {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (msg: string, ...optionalParams: any[]): void =>
    optionalParams
      ? console.log(`[${prefix}] ${msg}`, ...[...optionalParams, ...([suffix] ?? [])])
      : console.log(`[${prefix}] ${msg} - ${suffix}`);
}

export function debug(prefix: string, suffix?: string) {
  return log(prefix, suffix);
}

export function out(prefix: string, suffix?: string) {
  return {
    log: log(prefix, suffix),
    debug: debug(prefix, suffix),
  };
}
