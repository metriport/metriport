import { FIELD_SEPARATOR } from "./separator";

export function formatStrings({
  values,
  label,
  isDebug,
}: {
  values: string[] | undefined;
  label?: string;
  isDebug?: boolean;
}): string | undefined {
  if (values == undefined || values.length < 1) return undefined;
  const valuesStr = values.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${valuesStr}` : valuesStr;
}
