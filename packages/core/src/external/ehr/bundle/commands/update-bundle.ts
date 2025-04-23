import { BadRequestError, errorToString, MetriportError } from "@metriport/shared";
import {
  createBundleFromResourceList,
  FhirResource,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { uniqBy } from "lodash";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { BundleKeyBaseParams, createKeyMap, getS3UtilsInstance } from "../bundle-shared";
import { fetchBundle } from "./fetch-bundle";

export type UpdateBundleParams = Omit<BundleKeyBaseParams, "getLastModified"> & {
  resource: FhirResource;
};

/**
 * Updates a resource bundle with a new resource.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param bundleType - The bundle type.
 * @param resource - The resource to add to the bundle.
 * @param resourceType - The resource type of the bundle.
 * @param s3BucketName - The S3 bucket name (optional, defaults to the EHR bundle bucket)
 */
export async function updateBundle({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  bundleType,
  resource,
  resourceType,
  s3BucketName = Config.getEhrBundleBucketName(),
}: UpdateBundleParams): Promise<void> {
  const { log } = out(
    `EhrResourceDiff createOrReplaceBundle - ehr ${ehr} cxId ${cxId} metriportPatientId ${metriportPatientId} ehrPatientId ${ehrPatientId} bundleType ${bundleType} resourceType ${resourceType}`
  );
  if (resource.resourceType !== resourceType) {
    throw new BadRequestError("Invalid resource type", undefined, {
      bundleType,
      resourceType,
      invalidResourceResourceType: resource.resourceType,
    });
  }
  const s3Utils = getS3UtilsInstance();
  const createKey = createKeyMap[bundleType];
  if (!createKey) throw new BadRequestError("Invalid bundle type", undefined, { bundleType });
  const key = createKey({ ehr, cxId, metriportPatientId, ehrPatientId, resourceType });
  try {
    const newBundle = createBundleFromResourceList([resource]);
    const existingBundleWithLastModified = await fetchBundle({
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      bundleType,
      resourceType,
      s3BucketName,
    });
    if (existingBundleWithLastModified) {
      const existingBundle = existingBundleWithLastModified.bundle;
      newBundle.entry = uniqBy([...existingBundle.entry, ...newBundle.entry], "resource.id");
    }
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      file: Buffer.from(JSON.stringify(newBundle), "utf8"),
      contentType: "application/json",
    });
  } catch (error) {
    const msg = "Failure while updating bundle @ S3";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      bundleType,
      resourceType,
      resourceId: resource.id,
      key,
      context: "ehr-resource-diff.updateBundle",
    });
  }
}
