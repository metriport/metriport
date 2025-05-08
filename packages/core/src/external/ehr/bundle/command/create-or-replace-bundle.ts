import { BadRequestError, errorToString, MetriportError } from "@metriport/shared";
import { Bundle } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { BundleKeyBaseParams, createKeyMap, getS3UtilsInstance } from "../bundle-shared";

export type CreateOrReplaceBundleParams = Omit<BundleKeyBaseParams, "getLastModified"> & {
  bundle: Bundle;
};

/**
 * Creates or replaces a resource bundle.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param bundleType - The bundle type.
 * @param bundle - The bundle.
 * @param resourceType - The resource type of the bundle.
 * @param jobId - The job ID of the bundle. If not provided, the tag 'latest' will be used.
 * @param s3BucketName - The S3 bucket name (optional, defaults to the EHR bundle bucket)
 */
export async function createOrReplaceBundle({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  bundleType,
  bundle,
  resourceType,
  jobId,
  s3BucketName = Config.getEhrBundleBucketName(),
}: CreateOrReplaceBundleParams): Promise<void> {
  const { log } = out(
    `Ehr createOrReplaceBundle - ehr ${ehr} cxId ${cxId} metriportPatientId ${metriportPatientId} ehrPatientId ${ehrPatientId} bundleType ${bundleType} resourceType ${resourceType}`
  );
  const invalidResource = bundle.entry.find(entry => entry.resource.resourceType !== resourceType);
  if (invalidResource) {
    throw new BadRequestError("Invalid resource type in bundle", undefined, {
      bundleType,
      resourceType,
      invalidResourceResourceType: invalidResource.resource.resourceType,
    });
  }
  const s3Utils = getS3UtilsInstance();
  const createKey = createKeyMap[bundleType];
  if (!createKey) throw new BadRequestError("Invalid bundle type", undefined, { bundleType });
  const key = createKey({ ehr, cxId, metriportPatientId, ehrPatientId, resourceType, jobId });
  try {
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      file: Buffer.from(JSON.stringify(bundle), "utf8"),
      contentType: "application/json",
    });
  } catch (error) {
    const msg = "Failure while creating or replacing bundle @ S3";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      bundleType,
      resourceType,
      key,
      context: "ehr-resource-diff.createOrReplaceBundle",
    });
  }
}
