import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { ApiBaseParams, validateAndLogResponse } from "../api-shared";

export type StartWriteBackBundlesJobParams = Omit<ApiBaseParams, "practiceId" | "departmentId"> & {
  resourceType: string;
  createResourceDiffBundleJobId: string;
};

/**
 * Sends a request to the API to start the write back bundles job.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 * @param resourceType - The resource type.
 * @param createResourceDiffBundleJobId - The create resource diff bundle job ID.
 */
export async function startWriteBackBundlesJob({
  ehr,
  cxId,
  patientId,
  resourceType,
  createResourceDiffBundleJobId,
}: StartWriteBackBundlesJobParams): Promise<void> {
  const { log, debug } = out(`Ehr startWriteBackBundlesJob - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    resourceType,
    createResourceDiffBundleJobId,
  });
  const startWriteBackBundlesJobUrl = `/internal/ehr/${ehr}/patient/${patientId}/resource/write-back?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(startWriteBackBundlesJobUrl);
    });
    validateAndLogResponse(startWriteBackBundlesJobUrl, response, debug);
  } catch (error) {
    const msg = "Failure while starting write back bundles job @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      patientId,
      resourceType,
      createResourceDiffBundleJobId,
      url: startWriteBackBundlesJobUrl,
      context: "ehr.startWriteBackBundlesJob",
    });
  }
}
