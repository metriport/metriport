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
};

function createBundlePrefix({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
}: CreateBundlePrefixParams): string {
  return `${globalPrefix}/ehr=${ehr}/cx_id=${cxId}/metriport_patient_id=${metriportPatientId}/ehr_patient_id=${ehrPatientId}/resource_type=${resourceType}`;
}

export function createFileKeyEhrComplete(params: CreateBundlePrefixParams): string {
  return `${createBundlePrefix(params)}/ehr-complete.json`;
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
  EHR_COMPLETE = "EhrComplete",
  EHR_ONLY = "EhrOnly",
  METRIPORT_ONLY = "MetriportOnly",
}
export const createKeyMap: Record<BundleType, (params: CreateBundlePrefixParams) => string> = {
  [BundleType.EHR_COMPLETE]: createFileKeyEhrComplete,
  [BundleType.EHR_ONLY]: createFileKeyEhrOnly,
  [BundleType.METRIPORT_ONLY]: createFileKeyMetriportOnly,
};
