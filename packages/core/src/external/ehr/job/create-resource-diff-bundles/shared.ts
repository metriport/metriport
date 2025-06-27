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

const ehrSourcesWithCreateResourceDiffBundles = [
  EhrSources.canvas,
  EhrSources.athena,
  EhrSources.elation,
] as const;
export type EhrSourceWithCreateResourceDiffBundles =
  (typeof ehrSourcesWithCreateResourceDiffBundles)[number];
export function isEhrSourceWithCreateResourceDiffBundles(
  ehr: string
): ehr is EhrSourceWithCreateResourceDiffBundles {
  return ehrSourcesWithCreateResourceDiffBundles.includes(
    ehr as EhrSourceWithCreateResourceDiffBundles
  );
}
