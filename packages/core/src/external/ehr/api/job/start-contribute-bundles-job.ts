import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { ApiBaseParams, validateAndLogResponse } from "../api-shared";

export type StartContributeBundlesJobParams = Omit<ApiBaseParams, "practiceId" | "departmentId"> & {
  resourceType: string;
  createResourceDiffBundleJobId: string;
};

/**
 * Sends a request to the API to start the contribute bundles job.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 * @param resourceType - The resource type.
 * @param createResourceDiffBundleJobId - The create resource diff bundle job ID.
 */
export async function startContributeBundlesJob({
  ehr,
  cxId,
  patientId,
  resourceType,
  createResourceDiffBundleJobId,
}: StartContributeBundlesJobParams): Promise<void> {
  const { log, debug } = out(`Ehr startContributeBundlesJob - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    resourceType,
    createResourceDiffBundleJobId,
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
      createResourceDiffBundleJobId,
      url: startContributeBundlesJobUrl,
      context: "ehr.startContributeBundlesJob",
    });
  }
}
