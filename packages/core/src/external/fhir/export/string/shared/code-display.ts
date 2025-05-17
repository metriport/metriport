export function codeAndDisplayToString(
  code: string | undefined,
  display: string | undefined
): string | undefined {
  if (!code && !display) return undefined;
  if (code && display) return `${code} (${display})`;
  if (code) return code;
  return display;
}
