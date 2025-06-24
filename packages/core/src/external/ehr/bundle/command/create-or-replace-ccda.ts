import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { BundleKeyBaseParams, createFileKeyCcda, getS3UtilsInstance } from "../bundle-shared";

export type CreateOrReplaceCcdaParams = Omit<
  BundleKeyBaseParams,
  "bundleType" | "resourceId" | "getLastModified"
> & {
  payload: string;
};

/**
 * Creates or replaces a CCDA file.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param resourceType - The resource type of the CCDA file.
 * @param jobId - The job ID of the CCDA file. If not provided, the tag 'latest' will be used.
 * @param s3BucketName - The S3 bucket name (optional, defaults to the EHR bundle bucket)
 * @param payload - The payload of the CCDA file.
 * @param s3FileName - The S3 file name of the CCDA file.
 */
export async function createOrReplaceCcda({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  payload,
  resourceType,
  jobId,
  s3BucketName = Config.getEhrBundleBucketName(),
}: CreateOrReplaceCcdaParams): Promise<{
  s3key: string;
  s3BucketName: string;
}> {
  const { log } = out(
    `Ehr createOrReplaceCcda - ehr ${ehr} cxId ${cxId} ehrPatientId ${ehrPatientId}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyCcda({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    jobId,
  });
  try {
    await executeWithNetworkRetries(async () => {
      await s3Utils.uploadFile({
        bucket: s3BucketName,
        key,
        file: Buffer.from(payload, "utf8"),
        contentType: "application/xml",
      });
    });
    return { s3key: key, s3BucketName };
  } catch (error) {
    const msg = "Failure while creating or replacing CCDA file @ S3";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      resourceType,
      key,
      context: "ehr.createOrReplaceCcda",
    });
  }
}
