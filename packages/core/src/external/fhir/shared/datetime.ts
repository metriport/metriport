import { Period } from "@medplum/fhirtypes";
import { buildDayjsFromCompactDate } from "@metriport/shared/common/date";

export function buildPeriod(
  start?: string | undefined,
  end?: string | undefined
): Period | undefined {
  if (!start && !end) return undefined;

  return {
    ...(start ? { start: buildDayjsFromCompactDate(start).toISOString() } : {}),
    ...(end ? { end: buildDayjsFromCompactDate(end).toISOString() } : {}),
  };
}
