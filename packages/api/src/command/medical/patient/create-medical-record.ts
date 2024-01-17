import { MedicalRecordDateAndFormat, ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { ConsolidationConversionType } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { S3Utils, createS3FileName } from "@metriport/core/external/aws/s3";
import { HTML_FILE_EXTENSION, PDF_FILE_EXTENSION } from "@metriport/core/util/mime";
import { Patient } from "../../../domain/medical/patient";
import { Config } from "../../../shared/config";
import { MEDICAL_RECORD_KEY } from "./convert-fhir-bundle";

const awsRegion = Config.getAWSRegion();
const s3Utils = new S3Utils(awsRegion);
const bucketName = Config.getMedicalDocumentsBucketName();

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

export async function getExistingMedicalRecordInfo({
  patientId,
  cxId,
}: {
  patientId: string;
  cxId: string;
}): Promise<MedicalRecordDateAndFormat> {
  const s3FileKey = createS3FileName(
    cxId,
    patientId,
    `${MEDICAL_RECORD_KEY}${HTML_FILE_EXTENSION}`
  );
  const s3PdfFileKey = `${s3FileKey}${PDF_FILE_EXTENSION}`;

  const [htmlMRInfo, pdfMRInfo] = await Promise.all([
    s3Utils.getFileInfoFromS3(s3FileKey, bucketName),
    s3Utils.getFileInfoFromS3(s3PdfFileKey, bucketName),
  ]);

  return {
    htmlExists: htmlMRInfo.exists,
    pdfExists: pdfMRInfo.exists,
    date: htmlMRInfo.dateCreated ?? pdfMRInfo.dateCreated,
  };
}

export async function getExistingMedicalRecord({
  patientId,
  cxId,
  conversionType,
}: {
  patientId: string;
  cxId: string;
  conversionType: "pdf" | "html";
}): Promise<string> {
  const extension =
    conversionType === "html" ? HTML_FILE_EXTENSION : `${HTML_FILE_EXTENSION}${PDF_FILE_EXTENSION}`;
  const s3FileKey = createS3FileName(cxId, patientId, `${MEDICAL_RECORD_KEY}${extension}`);
  const url = await s3Utils.getSignedUrl({ bucketName, fileName: s3FileKey });
  return url;
}
