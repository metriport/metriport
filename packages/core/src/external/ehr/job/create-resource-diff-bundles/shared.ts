import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";

export type CreateResourceDiffBundlesBaseRequest = {
  ehr: EhrSource;
  tokenId?: string;
  cxId: string;
  practiceId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  resourceType: string;
  jobId: string;
  reportError?: boolean;
};

export function createSqsGroupId(metriportPatientId: string, resourceType: string): string {
  return `${metriportPatientId}-${resourceType}`;
}

const ehrSourcesWithCreateResourceDiffBundles = [EhrSources.canvas, EhrSources.athena] as const;
export type EhrSourceWithCreateResourceDiffBundles =
  (typeof ehrSourcesWithCreateResourceDiffBundles)[number];
export function isEhrSourceWithCreateResourceDiffBundles(
  ehr: string
): ehr is EhrSourceWithCreateResourceDiffBundles {
  return ehrSourcesWithCreateResourceDiffBundles.includes(
    ehr as EhrSourceWithCreateResourceDiffBundles
  );
}
