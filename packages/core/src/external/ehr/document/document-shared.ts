import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { Config } from "../../../util/config";
import { S3Utils } from "../../aws/s3";
import { createPrefix, CreatePrefixParams } from "../shared";

const globalCcdaPrefix = "ccda";
const globalHtmlPrefix = "html";
const region = Config.getAWSRegion();

type CreateDocumentPrefixParams = CreatePrefixParams & {
  resourceId?: string | undefined;
};

function createCcdaPrefix({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
  jobId,
  resourceId,
}: CreateDocumentPrefixParams): string {
  return `${createPrefix(globalCcdaPrefix, {
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    jobId,
  })}${resourceId ? `/resourceid=${resourceId}` : ""}`;
}

function createHtmlPrefix({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
  jobId,
  resourceId,
}: CreateDocumentPrefixParams): string {
  return `${createPrefix(globalHtmlPrefix, {
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    jobId,
  })}${resourceId ? `/resourceid=${resourceId}` : ""}`;
}

export function createFileKeyCcda(params: CreateDocumentPrefixParams): string {
  return `${createCcdaPrefix(params)}/ccda.xml`;
}

export function createFileKeyHtml(params: CreatePrefixParams): string {
  return `${createHtmlPrefix(params)}/html.html`;
}

export enum DocumentType {
  CCDA = "ccda",
  HTML = "html",
}

export const createKeyAndExtensionMap: Record<
  DocumentType,
  { key: (params: CreateDocumentPrefixParams) => string; extension: string }
> = {
  [DocumentType.CCDA]: { key: createFileKeyCcda, extension: "application/xml" },
  [DocumentType.HTML]: { key: createFileKeyHtml, extension: "text/html" },
};

export function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export type DocumentKeyBaseParams = {
  ehr: EhrSource;
  cxId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  documentType: DocumentType;
  resourceType: string;
  jobId?: string | undefined;
  resourceId?: string | undefined;
  s3BucketName?: string;
};
