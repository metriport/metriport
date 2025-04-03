export enum ResourceDiffDirection {
  DIFF_EHR = "Ehr",
  DIFF_METRIPORT = "Metriport",
}
export function isResourceDiffDirection(direction: string): direction is ResourceDiffDirection {
  return Object.values(ResourceDiffDirection).includes(direction as ResourceDiffDirection);
}
