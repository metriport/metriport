import { BadRequestError, EhrSource, errorToString, MetriportError } from "@metriport/shared";
import {
  Bundle,
  SupportedResourceType,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { BundleType, createKeyMap, getS3UtilsInstance } from "../bundle-shared";

export type CreateOrReplaceBundleParams = {
  ehr: EhrSource;
  cxId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  bundleType: BundleType;
  bundle: Bundle;
  resourceType: SupportedResourceType;
  s3BucketName?: string;
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
  s3BucketName = Config.getEhrBundleBucketName(),
}: CreateOrReplaceBundleParams): Promise<void> {
  const { log } = out(
    `EhrResourceDiff createOrReplaceBundle - ehr ${ehr} cxId ${cxId} metriportPatientId ${metriportPatientId} ehrPatientId ${ehrPatientId} bundleType ${bundleType} resourceType ${resourceType}`
  );
  const s3Utils = getS3UtilsInstance();
  const createKey = createKeyMap[bundleType];
  if (!createKey) throw new BadRequestError("Invalid bundle type", undefined, { bundleType });
  const key = createKey({ ehr, cxId, metriportPatientId, ehrPatientId, resourceType });
  try {
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      file: Buffer.from(JSON.stringify(bundle), "utf8"),
      contentType: "application/json",
    });
  } catch (error) {
    const msg = `Failure while creating or replacing bundle @ EhrResourceDiff`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      bundleType,
      key,
      context: "ehr-resource-diff.createOrReplaceBundle",
    });
  }
}
