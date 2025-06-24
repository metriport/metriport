import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Config } from "../../../util/config";
import { S3Utils } from "../../aws/s3";
import { supportedAthenaHealthResources } from "../athenahealth";
import { supportedCanvasResources } from "../canvas";
import { supportedElationResources } from "../elation";

const globalPrefix = "bundle";
const globalCcdaPrefix = "ccda";
const region = Config.getAWSRegion();

type CreateBundlePrefixParams = {
  ehr: EhrSource;
  cxId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  resourceType: string;
  jobId?: string | undefined;
  resourceId?: string | undefined;
};

type CreateCcdaPrefixParams = Omit<CreateBundlePrefixParams, "resourceId">;

function createPrefix(
  prefix: string,
  params: Omit<CreateBundlePrefixParams, "resourceId">
): string {
  return `${prefix}/ehr=${params.ehr}/cxid=${params.cxId}/metriportpatientid=${
    params.metriportPatientId
  }/ehrpatientid=${params.ehrPatientId}/resourcetype=${params.resourceType}/jobId=${
    params.jobId ?? "latest"
  }`;
}

function createBundlePrefix({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
  jobId,
  resourceId,
}: CreateBundlePrefixParams): string {
  return `${createPrefix(globalPrefix, {
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    jobId,
  })}${resourceId ? `/resourceid=${resourceId}` : ""}`;
}

function createCcdaPrefix({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
  jobId,
}: CreateCcdaPrefixParams): string {
  return `${createPrefix(globalCcdaPrefix, {
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    jobId,
  })}`;
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

export function createFileKeyCcda(params: CreateCcdaPrefixParams): string {
  return `${createCcdaPrefix(params)}/ccda.xml`;
}

export function createFileKeyResourceDiffDataContribution(
  params: CreateBundlePrefixParams
): string {
  return `${createBundlePrefix(params)}/ehr-data-contribution.json`;
}

export function getSupportedResourcesByEhr(ehr: EhrSource): string[] {
  if (ehr === EhrSources.canvas) return supportedCanvasResources;
  if (ehr === EhrSources.athena) return supportedAthenaHealthResources;
  if (ehr === EhrSources.elation) return supportedElationResources;
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
    bundleType === BundleType.RESOURCE_DIFF_DATA_CONTRIBUTION
  );
}

export const createKeyMap: Record<BundleType, (params: CreateBundlePrefixParams) => string> = {
  [BundleType.EHR]: createFileKeyEhr,
  [BundleType.EHR_DEDUPED]: createFileKeyEhrDeduped,
  [BundleType.METRIPORT]: createFileKeyMetriport,
  [BundleType.RESOURCE_DIFF_EHR_ONLY]: createFileKeyEhrOnly,
  [BundleType.RESOURCE_DIFF_METRIPORT_ONLY]: createFileKeyMetriportOnly,
  [BundleType.RESOURCE_DIFF_DATA_CONTRIBUTION]: createFileKeyResourceDiffDataContribution,
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
