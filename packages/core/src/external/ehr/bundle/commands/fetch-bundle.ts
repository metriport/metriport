import {
  BadRequestError,
  EhrSource,
  errorToString,
  MetriportError,
  NotFoundError,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  BundleWithLastModified,
  SupportedResourceType,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import dayjs from "dayjs";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { BundleType, createKeyMap, getS3UtilsInstance } from "../bundle-shared";

const MAX_AGE = dayjs.duration(24, "hours");

export type FetchBundleParams = {
  ehr: EhrSource;
  cxId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  bundleType: BundleType;
  resourceType: SupportedResourceType;
  s3BucketName?: string;
};

/**
 * Fetches a bundle from S3 for the given bundle type and resource type.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param bundleType - The bundle type.
 * @param resourceType - The resource type of the bundle.
 * @param s3BucketName - The S3 bucket name (optional, defaults to the EHR bundle bucket)
 * @returns The bundle with the last modified date or undefined if the bundle is not found.
 */
export async function fetchBundle({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  bundleType,
  resourceType,
  s3BucketName = Config.getEhrBundleBucketName(),
}: FetchBundleParams): Promise<BundleWithLastModified | undefined> {
  const { log } = out(
    `EhrResourceDiff fetchBundle - ehr ${ehr} cxId ${cxId} metriportPatientId ${metriportPatientId} ehrPatientId ${ehrPatientId} bundleType ${bundleType} resourceType ${resourceType}  `
  );
  const s3Utils = getS3UtilsInstance();
  const createKey = createKeyMap[bundleType];
  if (!createKey) throw new BadRequestError("Invalid bundle type", undefined, { bundleType });
  const key = createKey({ ehr, cxId, metriportPatientId, ehrPatientId, resourceType });
  try {
    const fileExists = await s3Utils.fileExists(s3BucketName, key);
    if (!fileExists) return undefined;
    const [file, fileInfo] = await Promise.all([
      s3Utils.getFileContentsAsString(s3BucketName, key),
      s3Utils.getFileInfoFromS3(s3BucketName, key),
    ]);
    return {
      bundle: JSON.parse(file),
      lastModified: fileInfo.createdAt,
    };
  } catch (error) {
    const msg = "Failure while fetching bundle @ EhrResourceDiff";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      bundleType,
      key,
      context: "ehr-resource-diff.fetchBundle",
    });
  }
}

/**
 * Fetches a bundle from S3 for the given bundle type and resource type
 * If the bundle is not found, it throws a NotFoundError.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param bundleType - The bundle type.
 * @param resourceType - The resource type of the bundle.
 * @param s3BucketName - The S3 bucket name (optional, defaults to the EHR bundle bucket)
 * @returns The bundle with the last modified date.
 * @throws NotFoundError if the bundle is not found.
 */
export async function fetchBundleOrFail({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  bundleType,
  resourceType,
  s3BucketName = Config.getEhrBundleBucketName(),
}: FetchBundleParams): Promise<BundleWithLastModified> {
  const bundle = await fetchBundle({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    bundleType,
    resourceType,
    s3BucketName,
  });
  if (!bundle) {
    throw new NotFoundError(`Bundle not found @ EhrResourceDiff`, {
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      bundleType,
      s3BucketName,
      context: "ehr-resource-diff.fetchBundleOrFail",
    });
  }
  return bundle;
}

/**
 * Fetches a bundle from S3 for the given bundle type and resource type
 * Checks if the bundle is younger than the max age, if so, it returns the bundle, otherwise it returns undefined.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param bundleType - The bundle type.
 * @param resourceType - The resource type of the bundle.
 * @param s3BucketName - The S3 bucket name (optional, defaults to the EHR bundle bucket)
 * @returns The bundle with the last modified date if it is younger than the max age, otherwise undefined.
 */
export async function fetchBundleYoungerThanMaxAge({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  bundleType,
  resourceType,
  s3BucketName = Config.getEhrBundleBucketName(),
}: FetchBundleParams): Promise<BundleWithLastModified | undefined> {
  const bundle = await fetchBundle({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    bundleType,
    resourceType,
    s3BucketName,
  });
  if (!bundle) return undefined;
  const age = dayjs.duration(buildDayjs().diff(bundle.lastModified));
  if (age.asMilliseconds() > MAX_AGE.asMilliseconds()) return undefined;
  return bundle;
}
