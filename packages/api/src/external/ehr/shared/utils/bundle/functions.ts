import {
  getSupportedResourcesByEhr,
  isSupportedResourceTypeByEhr,
} from "@metriport/core/external/ehr/bundle/bundle-shared";
import { BadRequestError } from "@metriport/shared";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { FetchBundleParams, FetchedBundlePreSignedUrls } from "./types";

export async function validateAndPrepareBundleFetch({
  ehr,
  cxId,
  ehrPatientId,
  resourceType,
}: Pick<FetchBundleParams, "ehr" | "cxId" | "ehrPatientId" | "resourceType">): Promise<
  Pick<FetchedBundlePreSignedUrls, "resourceTypes"> & { metriportPatientId: string }
> {
  const patientMapping = await getPatientMappingOrFail({
    cxId,
    externalId: ehrPatientId,
    source: ehr,
  });
  const metriportPatientId = patientMapping.patientId;
  if (resourceType && !isSupportedResourceTypeByEhr(ehr, resourceType)) {
    throw new BadRequestError("Resource type is not supported for bundle", undefined, {
      resourceType,
    });
  }
  const resourceTypes = resourceType ? [resourceType] : getSupportedResourcesByEhr(ehr);
  return { resourceTypes, metriportPatientId };
}
