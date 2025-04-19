import { SupportedResourceType } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { S3Utils } from "../../aws/s3";
import { Config } from "../../../util/config";
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

export function createFileKeyTotal({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
}: CreateBundlePrefixParams): string {
  return `${createBundlePrefix({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
  })}/ehr-total.json`;
}

export function createFileKeyEhrOnly({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
}: CreateBundlePrefixParams): string {
  return `${createBundlePrefix({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
  })}/ehr-only.json`;
}

export function createFileKeyMetriportOnly({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
}: CreateBundlePrefixParams): string {
  return `${createBundlePrefix({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
  })}/metriport-only.json`;
}

export function getSupportedResourcesByEhr(ehr: EhrSource): SupportedResourceType[] {
  if (ehr === EhrSources.canvas) return supportedCanvasDiffResources as SupportedResourceType[];
  return [];
}

export function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export enum BundleType {
  TOTAL = "Total",
  EHR_ONLY = "EhrOnly",
  METRIPORT_ONLY = "MetriportOnly",
}
export const createKeyMap: Record<BundleType, (params: CreateBundlePrefixParams) => string> = {
  [BundleType.TOTAL]: createFileKeyTotal,
  [BundleType.EHR_ONLY]: createFileKeyEhrOnly,
  [BundleType.METRIPORT_ONLY]: createFileKeyMetriportOnly,
};
