import { Resource } from "@medplum/fhirtypes";

export type OrderingFunction<R extends Resource> = (resources: R[]) => R[];

export type MergeFunction<R extends Resource> = (resources: R[]) => R;
export type MergeStrategy<R extends Resource, K extends keyof R> = (
  masterValue: R[K],
  values: Array<NonNullable<R[K]>>
) => R[K];

export interface MergeConfig<R extends Resource> {
  /**
   * Precedence of resource statuses from highest to lowest.
   */
  chooseMasterResource?: (resources: R[]) => R;
  statusPrecedence?: string[];
  mergeStrategy: {
    [K in keyof R]?: MergeStrategy<R, K>;
  };
}
