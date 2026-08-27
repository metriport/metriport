import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";

interface RecreateConsolidatedParams {
  cxId: string;
  patientId: string;
  useCachedAiBrief: boolean;
}

/**
 * Triggers a refresh of the consolidated bundle for a patient.
 *
 * @param params - The customer ID and patient ID
 */
export async function recreateConsolidatedBundle({
  cxId,
  patientId,
  useCachedAiBrief,
}: RecreateConsolidatedParams): Promise<void> {
  const { log } = out(`recreateConsolidated - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    useCachedAiBrief: useCachedAiBrief ? "true" : "false",
  });
  const refreshConsolidatedUrl = `/internal/patient/${patientId}/consolidated/refresh?${queryParams.toString()}`;
  try {
    await executeWithNetworkRetries(async () => {
      return api.post(refreshConsolidatedUrl);
    });
  } catch (error) {
    const msg = "Failure while refreshing consolidated bundle @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      patientId,
      url: refreshConsolidatedUrl,
      context: "refreshConsolidatedBundle",
    });
  }
}
