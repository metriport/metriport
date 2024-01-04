// https://stackoverflow.com/a/48244432/2099911
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

export function stringToBoolean(value?: string): boolean | undefined {
  if (!value) return undefined;
  return stringToBooleanRequired(value);
}

export function stringToBooleanRequired(value: string): boolean {
  return value.toLowerCase().trim() === "true";
}
