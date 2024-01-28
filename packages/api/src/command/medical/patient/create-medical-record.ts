import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { ConsolidationConversionType } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { Patient } from "@metriport/core/domain/patient";
import { S3Utils, createMRSummaryFileName } from "@metriport/core/external/aws/s3";
import { Config } from "../../../shared/config";
import { MedicalRecordsStatusDTO } from "../../../routes/medical/dtos/medical-record-summary-dto";

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

export async function getMedicalRecordSummaryStatus({
  patientId,
  cxId,
}: {
  patientId: string;
  cxId: string;
}): Promise<MedicalRecordsStatusDTO> {
  const s3FileKey = createMRSummaryFileName(cxId, patientId, "html");
  const s3PdfFileKey = createMRSummaryFileName(cxId, patientId, "pdf");

  const [htmlMRInfo, pdfMRInfo] = await Promise.all([
    s3Utils.getFileInfoFromS3(s3FileKey, bucketName),
    s3Utils.getFileInfoFromS3(s3PdfFileKey, bucketName),
  ]);

  return {
    html: {
      exists: htmlMRInfo.exists,
      createdAt: htmlMRInfo.createdAt,
    },
    pdf: {
      exists: pdfMRInfo.exists,
      createdAt: pdfMRInfo.createdAt,
    },
  };
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
  const { pdf, html } = await getMedicalRecordSummaryStatus({ patientId, cxId });

  if ((conversionType === "pdf" && pdf.exists) || (conversionType === "html" && html.exists)) {
    const s3FileKey = createMRSummaryFileName(cxId, patientId, conversionType);
    const url = await s3Utils.getSignedUrl({ bucketName, fileName: s3FileKey });
    return url;
  }
  return;
}
