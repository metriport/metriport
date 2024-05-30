import { ConsolidationConversionType } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { Patient } from "@metriport/core/domain/patient";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { Config } from "../../../shared/config";
import { getSignedURL } from "../document/document-download";
import { getPatient } from "./get-patient";
import { createSandboxMRSummaryFileName } from "./shared";

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
  let s3FileKey = createMRSummaryFileName(cxId, patientId, "html");
  let s3PdfFileKey = createMRSummaryFileName(cxId, patientId, "pdf");
  const isSandbox = Config.isSandbox();
  const seedBucket = Config.getSandboxSeedBucketName();
  let s3BucketName = bucketName;

  if (isSandbox && seedBucket) {
    const { s3HtmlSandboxKey, s3PdfSandboxKey } = await getSandboxFileNames(patientId, cxId);
    s3FileKey = s3HtmlSandboxKey;
    s3PdfFileKey = s3PdfSandboxKey;
    s3BucketName = seedBucket;
  }

  const [htmlMRInfo, pdfMRInfo] = await Promise.all([
    s3Utils.getFileInfoFromS3(s3FileKey, s3BucketName),
    s3Utils.getFileInfoFromS3(s3PdfFileKey, s3BucketName),
  ]);

  return {
    htmlCreatedAt: getCreatedAtDate(htmlMRInfo),
    pdfCreatedAt: getCreatedAtDate(pdfMRInfo),
  };
}

function getCreatedAtDate(info: { exists: boolean; createdAt?: Date }): string | undefined {
  const dateString =
    info.createdAt?.toString() ?? (info.exists ? DEFAULT_MR_CREATION_DATE_STRING : undefined);

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

  let s3BucketName = bucketName;

  if (Config.isSandbox()) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    s3BucketName = Config.getSandboxSeedBucketName()!;
    if (pdfIsValid || htmlIsValid) {
      const patientName = await getSandboxPatientName(patientId, cxId);
      const s3FileKey = createSandboxMRSummaryFileName(patientName, conversionType);
      const url = await getSignedURL({ bucketName: s3BucketName, fileName: s3FileKey });
      return url;
    }
  }

  if (pdfIsValid || htmlIsValid) {
    const s3FileKey = createMRSummaryFileName(cxId, patientId, conversionType);
    const url = await s3Utils.getSignedUrl({ bucketName: s3BucketName, fileName: s3FileKey });
    return url;
  }
  return;
}

async function getSandboxFileNames(
  patientId: string,
  cxId: string
): Promise<{ s3HtmlSandboxKey: string; s3PdfSandboxKey: string }> {
  const firstName = await getSandboxPatientName(patientId, cxId);
  const s3HtmlSandboxKey = createSandboxMRSummaryFileName(firstName, "html");
  const s3PdfSandboxKey = createSandboxMRSummaryFileName(firstName, "pdf");
  return { s3HtmlSandboxKey, s3PdfSandboxKey };
}

async function getSandboxPatientName(patientId: string, cxId: string) {
  const patient = await getPatient({ id: patientId, cxId });
  return patient ? patient.data.firstName.toLowerCase() : "jane";
}
