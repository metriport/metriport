import { lastElement } from "./util/array";

export function mergeStatus(
  masterStatus: string | undefined,
  statuses: string[]
): string | undefined {
  const firstStatus = masterStatus ? masterStatus : lastElement(statuses);
  if (!firstStatus) return undefined;
  return firstStatus;
}
