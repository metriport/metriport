import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { ApiBaseParams, validateAndLogResponse } from "../api-shared";

export type StartContributeBundlesJobParams = Omit<ApiBaseParams, "departmentId"> & {
  resourceType: string;
  createResourceDiffBundlesJobId: string;
};

/**
 * Sends a request to the API to start the contribute bundles job.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 * @param resourceType - The resource type.
 * @param createResourceDiffBundlesJobId - The create resource diff bundle job ID.
 */
export async function startContributeBundlesJob({
  ehr,
  cxId,
  practiceId,
  patientId,
  resourceType,
  createResourceDiffBundlesJobId,
}: StartContributeBundlesJobParams): Promise<void> {
  const { log, debug } = out(`Ehr startContributeBundlesJob - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    practiceId,
    resourceType,
    createResourceDiffBundlesJobId,
  });
  const startContributeBundlesJobUrl = `/internal/ehr/${ehr}/patient/${patientId}/resource/contribute?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(startContributeBundlesJobUrl);
    });
    validateAndLogResponse(startContributeBundlesJobUrl, response, debug);
  } catch (error) {
    const msg = "Failure while starting contribute bundles job @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      patientId,
      resourceType,
      createResourceDiffBundlesJobId,
      url: startContributeBundlesJobUrl,
      context: "ehr.startContributeBundlesJob",
    });
  }
}
