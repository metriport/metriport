import { MetriportError } from "@metriport/shared";
import { parseSearchsetFhirBundle, SearchSetBundle } from "@metriport/shared/medical";
import { createConsolidatedSnapshotFileName } from "../../domain/consolidated/filename";
import { S3Utils } from "../../external/aws/s3";
import { Config } from "../../util/config";
import { ConsolidatedFileType } from "./consolidated-shared";
import { ConsolidatedSnapshotRequest } from "./get-snapshot";

const NULL = "null";

export async function getConsolidatedSnapshotFromS3({
  bundleLocation,
  bundleFilename,
}: {
  bundleLocation: string;
  bundleFilename: string;
}): Promise<SearchSetBundle> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const bundleAsStr = await s3Utils.getFileContentsAsString(bundleLocation, bundleFilename);
  const bundle = parseSearchsetFhirBundle(bundleAsStr);
  if (!bundle) throw new MetriportError("Consolidated snapshot is not a valid FHIR bundle");
  return bundle;
}

export async function uploadConsolidatedSnapshotToS3({
  patient,
  requestId,
  resources,
  dateFrom,
  dateTo,
  bundle,
  s3BucketName,
  type,
}: Omit<ConsolidatedSnapshotRequest, "requestId" | "isAsync" | "conversionType"> & {
  requestId?: string | undefined;
  bundle: unknown;
  s3BucketName: string;
  type: ConsolidatedFileType;
}): Promise<{
  bucket: string;
  key: string;
}> {
  const key = createConsolidatedSnapshotFileName(patient.cxId, patient.id, requestId, type);
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
      },
    });
  } catch (error) {
    await s3Utils.uploadFile({
      ...uploadPayloadWithoutMeta,
      metadata: {
        from: dateFrom ?? NULL,
        to: dateTo ?? NULL,
        resources: (resources ?? []).length.toString(),
      },
    });
  }
  return { bucket: s3BucketName, key };
}
