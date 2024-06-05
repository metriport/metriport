// https://learn.microsoft.com/en-us/javascript/api/@azure/keyvault-certificates/requireatleastone?view=azure-node-latest
export type AtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>;
}[keyof T];

export function stringToBoolean(value?: string): boolean | undefined {
  if (!value) return undefined;
  return stringToBooleanRequired(value);
}

/**
 * @deprecated Use isTrue() instead
 */
export function stringToBooleanRequired(value: string): boolean {
  return value.toLowerCase().trim() === "true";
}
