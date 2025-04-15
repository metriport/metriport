import { BadRequestError, EhrSource, errorToString, MetriportError } from "@metriport/shared";
import {
  createBundleFromResourceList,
  FhirResource,
  SupportedResourceType,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { uniqBy } from "lodash";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { BundleType, createKeyMap, getS3UtilsInstance } from "../resource-dfff-shared";
import { fetchBundle } from "./fetch-bundle";

export type CreateOrReplaceBundleParams = {
  ehr: EhrSource;
  cxId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  bundleType: BundleType;
  resource: FhirResource;
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
 * @param resource - The resource to add to the bundle.
 * @param resourceType - The resource type to include in the bundle.
 * @param s3BucketName - The S3 bucket name.
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
}: CreateOrReplaceBundleParams): Promise<void> {
  const { log } = out(
    `EhrResourceDiff createOrReplaceBundle - ehr ${ehr} cxId ${cxId} metriportPatientId ${metriportPatientId} ehrPatientId ${ehrPatientId} bundleType ${bundleType} resourceType ${resourceType}`
  );
  const s3Utils = getS3UtilsInstance();
  const createKey = createKeyMap[bundleType];
  if (!createKey) throw new BadRequestError("Invalid bundle type", undefined, { bundleType });
  const key = createKey({ ehr, cxId, metriportPatientId, ehrPatientId, resourceType });
  try {
    const newBundle = createBundleFromResourceList([resource]);
    const existingBundle = await fetchBundle({
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      bundleType,
      resourceType,
      s3BucketName,
    });
    if (existingBundle) {
      newBundle.entry = uniqBy([...existingBundle.bundle.entry, ...newBundle.entry], "resource.id");
    }
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      file: Buffer.from(JSON.stringify(newBundle), "utf8"),
      contentType: "application/json",
    });
  } catch (error) {
    const msg = `Failure while updating bundle @ EhrResourceDiff`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      bundleType,
      key,
      context: "ehr-resource-diff.updateBundle",
    });
  }
}
