import { SupportedResourceType } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { S3Utils } from "../../aws/s3";
import { Config } from "../../../util/config";
import { supportedCanvasDiffResources } from "../canvas";

const globalPrefix = "resource-diff";
const region = Config.getAWSRegion();

type CreateCxMetriportPrefixParams = {
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
}: CreateCxMetriportPrefixParams): string {
  return `${globalPrefix}/ehr=${ehr}/cxid=${cxId}/metriportid=${metriportPatientId}/patientid=${ehrPatientId}/resourceType=${resourceType}`;
}

export function createFileKeyTotal({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
}: CreateCxMetriportPrefixParams): string {
  return `${createBundlePrefix({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
  })}/total.json`;
}

export function createFileKeyEhrOnly({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
}: CreateCxMetriportPrefixParams): string {
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
}: CreateCxMetriportPrefixParams): string {
  return `${createBundlePrefix({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
  })}/metriport-only.json`;
}

export function createFileKeyBoth({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
}: CreateCxMetriportPrefixParams): string {
  return `${createBundlePrefix({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
  })}/both.json`;
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
  BOTH = "Both",
}
export const createKeyMap: Record<BundleType, (params: CreateCxMetriportPrefixParams) => string> = {
  [BundleType.TOTAL]: createFileKeyTotal,
  [BundleType.EHR_ONLY]: createFileKeyEhrOnly,
  [BundleType.METRIPORT_ONLY]: createFileKeyMetriportOnly,
  [BundleType.BOTH]: createFileKeyBoth,
};
