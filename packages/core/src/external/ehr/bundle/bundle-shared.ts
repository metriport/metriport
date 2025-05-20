import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Config } from "../../../util/config";
import { S3Utils } from "../../aws/s3";
import { supportedCanvasResources } from "../canvas";

const globalPrefix = "bundle";
const region = Config.getAWSRegion();

type CreateBundlePrefixParams = {
  ehr: EhrSource;
  cxId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  resourceType: string;
  jobId?: string | undefined;
};

function createBundlePrefix({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
  jobId,
}: CreateBundlePrefixParams): string {
  return `${globalPrefix}/ehr=${ehr}/cxid=${cxId}/metriportpatientid=${metriportPatientId}/ehrpatientid=${ehrPatientId}/resourcetype=${resourceType}/jobId=${
    jobId ?? "latest"
  }`;
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

export function getSupportedResourcesByEhr(ehr: EhrSource): string[] {
  if (ehr === EhrSources.canvas) return supportedCanvasResources;
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
}
export function isBundleType(bundleType: string): bundleType is BundleType {
  return Object.values(BundleType).includes(bundleType as BundleType);
}

export type ResourceDiffBundleType =
  | BundleType.RESOURCE_DIFF_EHR_ONLY
  | BundleType.RESOURCE_DIFF_METRIPORT_ONLY;
export function isResourceDiffBundleType(
  bundleType: string
): bundleType is BundleType.RESOURCE_DIFF_EHR_ONLY | BundleType.RESOURCE_DIFF_METRIPORT_ONLY {
  return (
    bundleType === BundleType.RESOURCE_DIFF_EHR_ONLY ||
    bundleType === BundleType.RESOURCE_DIFF_METRIPORT_ONLY
  );
}

export const createKeyMap: Record<BundleType, (params: CreateBundlePrefixParams) => string> = {
  [BundleType.EHR]: createFileKeyEhr,
  [BundleType.EHR_DEDUPED]: createFileKeyEhrDeduped,
  [BundleType.METRIPORT]: createFileKeyMetriport,
  [BundleType.RESOURCE_DIFF_EHR_ONLY]: createFileKeyEhrOnly,
  [BundleType.RESOURCE_DIFF_METRIPORT_ONLY]: createFileKeyMetriportOnly,
};

export type BundleKeyBaseParams = {
  ehr: EhrSource;
  cxId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  bundleType: BundleType;
  resourceType: string;
  jobId?: string | undefined;
  getLastModified?: boolean;
  s3BucketName?: string;
};
