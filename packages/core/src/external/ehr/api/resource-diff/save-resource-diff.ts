import { errorToString, MetriportError } from "@metriport/shared";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";

export type SaveResourceDiffParams = {
  ehr: EhrSource;
  cxId: string;
  patientId: string;
  resourceId: string;
  direction: ResourceDiffDirection;
  matchedResourceIds: string[];
};

/**
 * Sends a request to the API to save a resource diff.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 * @param resourceId - The resource ID.
 * @param direction - The direction of the resource diff.
 * @param matchedResourceIds - The matched resource IDs.
 */
export async function saveResourceDiff({
  ehr,
  cxId,
  patientId,
  resourceId,
  direction,
  matchedResourceIds,
}: SaveResourceDiffParams): Promise<void> {
  const { log, debug } = out(`Ehr saveResourceDiff - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    patientId,
    resourceId,
    direction,
    matchedResourceIds: matchedResourceIds.join(","),
  });
  const saveResourceDiffUrl = `/internal/ehr/${ehr}/patient/save-resource-diff?${queryParams.toString()}`;
  try {
    const response = await api.post(saveResourceDiffUrl);
    if (!response.data) throw new Error(`No body returned from ${saveResourceDiffUrl}`);
    debug(`${saveResourceDiffUrl} resp: ${JSON.stringify(response.data)}`);
  } catch (error) {
    const msg = `Failure while saving resource diff @ Ehr`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      patientId,
      resourceId,
      direction,
      url: saveResourceDiffUrl,
      context: "ehr.saveResourceDiff",
    });
  }
}
