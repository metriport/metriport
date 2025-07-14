import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { ApiBaseParams, validateAndLogResponse } from "../api-shared";

export type StartWriteBackBundlesJobParams = Omit<ApiBaseParams, "departmentId"> & {
  resourceType: string;
  createResourceDiffBundlesJobId: string;
};

/**
 * Sends a request to the API to start the write back bundles job.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 * @param resourceType - The resource type.
 * @param createResourceDiffBundlesJobId - The create resource diff bundle job ID.
 */
export async function startWriteBackBundlesJob({
  ehr,
  cxId,
  practiceId,
  patientId,
  resourceType,
  createResourceDiffBundlesJobId,
}: StartWriteBackBundlesJobParams): Promise<void> {
  const { log, debug } = out(`Ehr startWriteBackBundlesJob - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    practiceId,
    resourceType,
    createResourceDiffBundlesJobId,
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
      createResourceDiffBundlesJobId,
      url: startWriteBackBundlesJobUrl,
      context: "ehr.startWriteBackBundlesJob",
    });
  }
}
