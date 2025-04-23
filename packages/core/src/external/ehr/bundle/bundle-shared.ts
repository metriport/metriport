import { SupportedResourceType } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Config } from "../../../util/config";
import { S3Utils } from "../../aws/s3";
import { supportedCanvasDiffResources } from "../canvas";

const globalPrefix = "bundle";
const region = Config.getAWSRegion();

type CreateBundlePrefixParams = {
  ehr: EhrSource;
  cxId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  resourceType: SupportedResourceType;
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

export function createFileKeyEhrOnly(params: CreateBundlePrefixParams): string {
  return `${createBundlePrefix(params)}/ehr-only.json`;
}

export function createFileKeyMetriportOnly(params: CreateBundlePrefixParams): string {
  return `${createBundlePrefix(params)}/metriport-only.json`;
}

export function getSupportedResourcesByEhr(ehr: EhrSource): SupportedResourceType[] {
  if (ehr === EhrSources.canvas) return supportedCanvasDiffResources as SupportedResourceType[];
  return [];
}

export function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export enum BundleType {
  EHR = "Ehr",
  RESOURCE_DIFF_EHR_ONLY = "ResourceDiffEhrOnly",
  RESOURCE_DIFF_METRIPORT_ONLY = "ResourceDiffMetriportOnly",
}
export const createKeyMap: Record<BundleType, (params: CreateBundlePrefixParams) => string> = {
  [BundleType.EHR]: createFileKeyEhr,
  [BundleType.RESOURCE_DIFF_EHR_ONLY]: createFileKeyEhrOnly,
  [BundleType.RESOURCE_DIFF_METRIPORT_ONLY]: createFileKeyMetriportOnly,
};

export type BundleKeyBaseParams = {
  ehr: EhrSource;
  cxId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  bundleType: BundleType;
  resourceType: SupportedResourceType;
  jobId?: string | undefined;
  getLastModified?: boolean;
  s3BucketName?: string;
};
