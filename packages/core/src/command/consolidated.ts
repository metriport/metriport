import { Resource } from "@medplum/fhirtypes";
import { ConsolidationConversionType } from "@metriport/api-sdk";
import { SearchSetBundle } from "@metriport/shared/medical";
import { createFilePath } from "../domain/filename";
import { S3Utils } from "../external/aws/s3";
import { ConsolidatedFhirToBundlePayload } from "../external/fhir/consolidated";
import { Config } from "../util/config";

const NULL = "null";

export type ConsolidatedFhirToBundleRequest = ConsolidatedFhirToBundlePayload & {
  conversionType?: ConsolidationConversionType;
} & ({ requestId: string; isAsync: true } | { requestId?: string; isAsync: false });

export type ConsolidatedFhirToBundleResponse = {
  bundleLocation: string;
  bundleFilename: string;
};

export async function getConsolidatedBundleFromS3({
  bundleLocation,
  bundleFilename,
}: {
  bundleLocation: string;
  bundleFilename: string;
}): Promise<SearchSetBundle<Resource>> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const bundleAsStr = await s3Utils.getFileContentsAsString(bundleLocation, bundleFilename);
  const bundle = JSON.parse(bundleAsStr) as SearchSetBundle<Resource>;
  return bundle;
}

export async function uploadConsolidatedBundleToS3({
  patient,
  requestId,
  documentIds,
  resources,
  dateFrom,
  dateTo,
  bundle,
  s3BucketName,
}: Omit<ConsolidatedFhirToBundleRequest, "isAsync" | "conversionType"> & {
  bundle: unknown;
  s3BucketName: string;
}): Promise<{
  bucket: string;
  key: string;
}> {
  const key = createConsolidatedFileName(patient.cxId, patient.id, requestId);
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const uploadPayloadWithoutMeta = {
    bucket: s3BucketName,
    key,
    file: Buffer.from(JSON.stringify(bundle)),
    contentType: "application/json",
  };
  // Meta can have up to 2KB, so we'll fallback to simplified if fails to upload with full meta
  try {
    await s3Utils.uploadFile({
      ...uploadPayloadWithoutMeta,
      metadata: {
        from: dateFrom ?? NULL,
        to: dateTo ?? NULL,
        resources: (resources ?? []).join(","),
        docs: (documentIds ?? []).join(","),
      },
    });
  } catch (error) {
    await s3Utils.uploadFile({
      ...uploadPayloadWithoutMeta,
      metadata: {
        from: dateFrom ?? NULL,
        to: dateTo ?? NULL,
        resources: (resources ?? []).length.toString(),
        docs: (documentIds ?? []).length.toString(),
      },
    });
  }
  return { bucket: s3BucketName, key };
}

function createConsolidatedFileName(cxId: string, patientId: string, requestId?: string): string {
  const date = new Date().toISOString();
  return createFilePath(cxId, patientId, `consolidated_${date}_${requestId}.json`);
}
