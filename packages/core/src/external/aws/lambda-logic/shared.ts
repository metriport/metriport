export type Log = ReturnType<typeof prefixedLog>;

export function prefixedLog(prefix: string) {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (msg: string, ...optionalParams: any[]): void =>
    optionalParams
      ? console.log(`[${prefix}] ${msg}`, ...optionalParams)
      : console.log(`[${prefix}] ${msg}`);
}
