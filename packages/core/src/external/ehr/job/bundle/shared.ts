import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";

export type ResourceDiffBundlesBaseRequest = {
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

const ehrSourcesWithResourceDiffBundles = [
  EhrSources.canvas,
  EhrSources.athena,
  EhrSources.elation,
  EhrSources.healthie,
] as const;
export type EhrSourceWithResourceDiffBundles = (typeof ehrSourcesWithResourceDiffBundles)[number];
export function isEhrSourceWithResourceDiffBundles(
  ehr: string
): ehr is EhrSourceWithResourceDiffBundles {
  return ehrSourcesWithResourceDiffBundles.includes(ehr as EhrSourceWithResourceDiffBundles);
}
