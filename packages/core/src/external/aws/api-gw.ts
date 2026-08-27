export function getClientAddressFromHeader(
  headers?: Record<string, string | undefined>
): string | undefined {
  const value = headers?.["x-forwarded-for"]?.split(",")[0]?.trim();
  return value || undefined;
}
