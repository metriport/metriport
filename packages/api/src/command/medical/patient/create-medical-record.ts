import { ConsolidationConversionType } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { Patient } from "@metriport/core/domain/patient";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { ResourceTypeForConsolidation } from "../../../domain/medical/consolidation-resources";
import { Config } from "../../../shared/config";

const awsRegion = Config.getAWSRegion();
const s3Utils = new S3Utils(awsRegion);
const bucketName = Config.getMedicalDocumentsBucketName();
const DEFAULT_MR_CREATION_DATE_STRING = new Date("2023-09-21").toString(); // The date of the MAPI launch

export type GetConsolidatedFilters = {
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  conversionType?: ConsolidationConversionType;
};

export type GetConsolidatedParams = {
  patient: Pick<Patient, "id" | "cxId" | "data">;
  documentIds?: string[];
} & GetConsolidatedFilters;

export type ConsolidatedQueryParams = {
  cxId: string;
  patientId: string;
  cxConsolidatedRequestMetadata?: unknown;
} & GetConsolidatedFilters;

type MedicalRecordsStatus = {
  htmlCreatedAt?: string;
  pdfCreatedAt?: string;
};

export async function getMedicalRecordSummaryStatus({
  patientId,
  cxId,
}: {
  patientId: string;
  cxId: string;
}): Promise<MedicalRecordsStatus> {
  const s3FileKey = createMRSummaryFileName(cxId, patientId, "html");
  const s3PdfFileKey = createMRSummaryFileName(cxId, patientId, "pdf");

  const [htmlMRInfo, pdfMRInfo] = await Promise.all([
    s3Utils.getFileInfoFromS3(s3FileKey, bucketName),
    s3Utils.getFileInfoFromS3(s3PdfFileKey, bucketName),
  ]);

  return {
    htmlCreatedAt: getCreatedAtDate(htmlMRInfo),
    pdfCreatedAt: getCreatedAtDate(pdfMRInfo),
  };
}

function getCreatedAtDate(info: { exists: boolean; createdAt?: Date }): string | undefined {
  const dateString =
    info.createdAt?.toLocaleString("en-US") ??
    (info.exists ? DEFAULT_MR_CREATION_DATE_STRING : undefined);

  return dateString;
}

export async function getMedicalRecordSummary({
  patientId,
  cxId,
  conversionType,
}: {
  patientId: string;
  cxId: string;
  conversionType: "pdf" | "html";
}): Promise<string | undefined> {
  const { pdfCreatedAt, htmlCreatedAt } = await getMedicalRecordSummaryStatus({ patientId, cxId });
  const pdfIsValid = conversionType === "pdf" && pdfCreatedAt;
  const htmlIsValid = conversionType === "html" && htmlCreatedAt;

  if (pdfIsValid || htmlIsValid) {
    const s3FileKey = createMRSummaryFileName(cxId, patientId, conversionType);
    const url = await s3Utils.getSignedUrl({ bucketName, fileName: s3FileKey });
    return url;
  }
  return;
}
