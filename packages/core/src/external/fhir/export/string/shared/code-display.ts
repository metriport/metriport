import { isUsefulDisplay } from "../../../codeable-concept";

export function codeAndDisplayToString(
  code: string | undefined,
  display: string | undefined
): string | undefined {
  if (!code && !display) return undefined;
  if (code && isUsefulDisplay(display)) return `${code} (${display})`;
  if (code) return code;
  return isUsefulDisplay(display) ? display : undefined;
}
