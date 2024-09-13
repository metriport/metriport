import { Resource } from "@medplum/fhirtypes";
import { SearchSetBundle } from "@metriport/shared/medical";
import { createConsolidatedSnapshotFileName } from "../../domain/consolidated/filename";
import { S3Utils } from "../../external/aws/s3";
import { Config } from "../../util/config";
import { ConsolidatedSnapshotRequest } from "./get-snapshot";

const NULL = "null";

export async function getConsolidatedSnapshotFromS3({
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

export async function uploadConsolidatedSnapshotToS3({
  patient,
  requestId,
  documentIds,
  resources,
  dateFrom,
  dateTo,
  bundle,
  s3BucketName,
  isDeduped,
}: Omit<ConsolidatedSnapshotRequest, "requestId" | "isAsync" | "conversionType"> & {
  requestId?: string;
  bundle: unknown;
  s3BucketName: string;
  isDeduped?: boolean;
}): Promise<{
  bucket: string;
  key: string;
}> {
  const key = createConsolidatedSnapshotFileName(patient.cxId, patient.id, requestId, isDeduped);
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
