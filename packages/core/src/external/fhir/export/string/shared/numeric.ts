export function formatNumeric({
  value,
  unit = "",
  label,
  isDebug,
}: {
  value: number | undefined;
  unit?: string | undefined;
  label?: string;
  isDebug?: boolean;
}): string | undefined {
  if (value == undefined) return undefined;
  const unitStr = unit ? ` ${unit}` : "";
  const valueStr = `${value}${unitStr}`;
  return isDebug && label ? `${label}: ${valueStr}` : valueStr;
}

export function formatNumericWithMax({
  value,
  valueMax,
  unit = "",
  label,
  isDebug,
}: {
  value: number | undefined;
  valueMax: number | undefined;
  unit?: string | undefined;
  label?: string;
  isDebug?: boolean;
}): string | undefined {
  if (value == undefined) return undefined;
  const unitStr = unit ? ` ${unit}` : "";
  if (valueMax == undefined) {
    const valueStr = `${value}${unitStr}`;
    return isDebug && label ? `${label}: ${valueStr}` : valueStr;
  }
  const valueWithMaxStr = `${value}-${valueMax}${unitStr}`;
  return isDebug && label ? `${label}: ${valueWithMaxStr}` : valueWithMaxStr;
}
