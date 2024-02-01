import { ConsolidationConversionType } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { Patient } from "@metriport/core/domain/patient";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { ResourceTypeForConsolidation } from "../../../domain/medical/consolidation-resources";
import { Config } from "../../../shared/config";

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

type MedicalRecordsStatus = {
  html: {
    exists: boolean;
    createdAt?: string;
  };
  pdf: {
    exists: boolean;
    createdAt?: string;
  };
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
    html: {
      exists: htmlMRInfo.exists,
      createdAt: htmlMRInfo.createdAt?.toString(),
    },
    pdf: {
      exists: pdfMRInfo.exists,
      createdAt: pdfMRInfo.createdAt?.toString(),
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
