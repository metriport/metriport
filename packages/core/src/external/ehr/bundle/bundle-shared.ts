import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Config } from "../../../util/config";
import { S3Utils } from "../../aws/s3";
import { supportedAthenaHealthResources } from "../athenahealth";
import { supportedCanvasResources } from "../canvas";
import { supportedElationResources } from "../elation";
import { supportedHealthieResources } from "../healthie";
import { createPrefix, CreatePrefixParams } from "../shared";

const globalPrefix = "bundle";
const region = Config.getAWSRegion();

type CreateBundlePrefixParams = CreatePrefixParams & {
  resourceId?: string | undefined;
};

function createBundlePrefix({ resourceId, ...rest }: CreateBundlePrefixParams): string {
  return `${createPrefix(globalPrefix, rest)}${resourceId ? `/resourceid=${resourceId}` : ""}`;
}

export function createFileKeyEhr(params: CreateBundlePrefixParams): string {
  return `${createBundlePrefix(params)}/ehr.json`;
}

export function createFileKeyEhrDeduped(params: CreateBundlePrefixParams): string {
  return `${createBundlePrefix(params)}/ehr-deduped.json`;
}

export function createFileKeyMetriport(params: CreateBundlePrefixParams): string {
  return `${createBundlePrefix(params)}/metriport.json`;
}

export function createFileKeyEhrOnly(params: CreateBundlePrefixParams): string {
  return `${createBundlePrefix(params)}/ehr-only.json`;
}

export function createFileKeyMetriportOnly(params: CreateBundlePrefixParams): string {
  return `${createBundlePrefix(params)}/metriport-only.json`;
}

export function createFileKeyResourceDiffDataContribution(
  params: CreateBundlePrefixParams
): string {
  return `${createBundlePrefix(params)}/ehr-data-contribution.json`;
}

export function createFileKeyResourceDiffWriteBack(params: CreateBundlePrefixParams): string {
  return `${createBundlePrefix(params)}/ehr-write-back.json`;
}

export function getSupportedResourcesByEhr(ehr: EhrSource): string[] {
  if (ehr === EhrSources.canvas) return supportedCanvasResources;
  if (ehr === EhrSources.athena) return supportedAthenaHealthResources;
  if (ehr === EhrSources.elation) return supportedElationResources;
  if (ehr === EhrSources.healthie) return supportedHealthieResources;
  return [];
}

export function isSupportedResourceTypeByEhr(ehr: EhrSource, resourceType: string): boolean {
  const supportedResources = getSupportedResourcesByEhr(ehr);
  return supportedResources.includes(resourceType);
}

export function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export enum BundleType {
  EHR = "Ehr",
  EHR_DEDUPED = "EhrDeduped",
  METRIPORT = "Metriport",
  RESOURCE_DIFF_EHR_ONLY = "ResourceDiffEhrOnly",
  RESOURCE_DIFF_METRIPORT_ONLY = "ResourceDiffMetriportOnly",
  RESOURCE_DIFF_DATA_CONTRIBUTION = "ResourceDiffDataContribution",
  RESOURCE_DIFF_WRITE_BACK = "ResourceDiffWriteBack",
}
export function isBundleType(bundleType: string): bundleType is BundleType {
  return Object.values(BundleType).includes(bundleType as BundleType);
}

export type ResourceDiffBundleType =
  | BundleType.RESOURCE_DIFF_EHR_ONLY
  | BundleType.RESOURCE_DIFF_METRIPORT_ONLY
  | BundleType.RESOURCE_DIFF_DATA_CONTRIBUTION;
export function isResourceDiffBundleType(bundleType: string): bundleType is ResourceDiffBundleType {
  return (
    bundleType === BundleType.RESOURCE_DIFF_EHR_ONLY ||
    bundleType === BundleType.RESOURCE_DIFF_METRIPORT_ONLY ||
    bundleType === BundleType.RESOURCE_DIFF_DATA_CONTRIBUTION ||
    bundleType === BundleType.RESOURCE_DIFF_WRITE_BACK
  );
}

export const createKeyMap: Record<BundleType, (params: CreateBundlePrefixParams) => string> = {
  [BundleType.EHR]: createFileKeyEhr,
  [BundleType.EHR_DEDUPED]: createFileKeyEhrDeduped,
  [BundleType.METRIPORT]: createFileKeyMetriport,
  [BundleType.RESOURCE_DIFF_EHR_ONLY]: createFileKeyEhrOnly,
  [BundleType.RESOURCE_DIFF_METRIPORT_ONLY]: createFileKeyMetriportOnly,
  [BundleType.RESOURCE_DIFF_DATA_CONTRIBUTION]: createFileKeyResourceDiffDataContribution,
  [BundleType.RESOURCE_DIFF_WRITE_BACK]: createFileKeyResourceDiffWriteBack,
};

export type BundleKeyBaseParams = {
  ehr: EhrSource;
  cxId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  bundleType: BundleType;
  resourceType: string;
  jobId?: string | undefined;
  resourceId?: string | undefined;
  getLastModified?: boolean;
  s3BucketName?: string;
};
