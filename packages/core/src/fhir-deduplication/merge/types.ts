import { Resource } from "@medplum/fhirtypes";

export type OrderingFunction<R extends Resource> = (resources: R[]) => R[];

export type MergeFunction<R extends Resource> = (resources: R[]) => R;
export type MergeStrategy<R extends Resource, K extends keyof R> = (
  masterValue: R[K],
  values: Array<NonNullable<R[K]>>
) => R[K];

export type MergeMap<R extends Resource> = { [K in keyof R]: Array<NonNullable<R[K]>> };

export type MergeStatusPrecedence<R extends Resource> = Array<ResourceStatus<R>>;
export type ResourceStatus<R extends Resource> = R extends { status?: infer S } ? S : never;

export interface MergeConfig<R extends Resource> {
  /**
   * Precedence of resource statuses from highest to lowest.
   */
  chooseMasterResource?: (resources: R[]) => R;
  statusPrecedence?: MergeStatusPrecedence<R>;
  mergeStrategy: {
    [K in keyof R]?: MergeStrategy<R, K>;
  };
}
