export type ErrorToStringOptions = { detailed: boolean };

export function errorToString(
  err: unknown,
  options: ErrorToStringOptions = { detailed: true }
): string {
  if (options.detailed) {
    return detailedErrorToString(err);
  }
  return genericErrorToString(err);
}

export function genericErrorToString(err: unknown): string {
  return (err as any)["message"] ?? String(err); // eslint-disable-line @typescript-eslint/no-explicit-any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function detailedErrorToString(error: any): string {
  if (!error) return "undefined";
  const thisErrorMessage = error.message ? error.message : error.toString();
  const additionalInfo = error.additionalInfo ? JSON.stringify(error.additionalInfo) : undefined;
  const causeMessage = error.cause ? detailedErrorToString(error.cause) : undefined;
  return (
    `${thisErrorMessage}` +
    `${additionalInfo ? ` (${additionalInfo})` : ""}` +
    `${causeMessage ? `; caused by ${causeMessage}` : ""}`
  );
}
