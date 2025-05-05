export const ResourceDiffDirection = {
  METRIPORT_ONLY: "metriport-only",
  EHR_ONLY: "ehr-only",
} as const;
export type ResourceDiffDirection =
  (typeof ResourceDiffDirection)[keyof typeof ResourceDiffDirection];
export function isResourceDiffDirection(direction: string): direction is ResourceDiffDirection {
  return Object.values(ResourceDiffDirection).includes(direction as ResourceDiffDirection);
}
