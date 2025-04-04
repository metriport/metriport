import { errorToString, MetriportError } from "@metriport/shared";
import { FhirResource } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";

/**
 * Sends a request to the API to sync a patient with Metriport.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 * @param resourceId - The resource ID.
 * @param direction - The direction of the resource diff.
 * @param matchedResourceIds - The matched resource IDs.
 */
export async function computeResourceDiff({
  ehr,
  cxId,
  practiceId,
  patientId,
  resource,
  direction,
}: {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  patientId: string;
  resource: FhirResource;
  direction: ResourceDiffDirection;
}): Promise<void> {
  const { log, debug } = out(`Ehr computeResourceDiff - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    practiceId,
    patientId,
    direction,
  });
  const computeResourceDiffUrl = `/internal/ehr/${ehr}/patient/compute-resource-diff?${queryParams.toString()}`;
  try {
    const response = await api.post(computeResourceDiffUrl, resource);
    if (!response.data) throw new Error(`No body returned from ${computeResourceDiffUrl}`);
    debug(`${computeResourceDiffUrl} resp: ${JSON.stringify(response.data)}`);
  } catch (error) {
    const msg = `Failure while computing resource diff @ Ehr`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      patientId,
      direction,
      url: computeResourceDiffUrl,
      context: "ehr.computeResourceDiff",
    });
  }
}
