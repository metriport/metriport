import axios from "axios";
import { Config } from "../../../util/config";
import { withDefaultApiErrorHandling } from "./shared";

/**
 * Starts the patient discovery query for a patient, in the context of a bulk patient import.
 *
 * @param cxId - The ID of the customer.
 * @param patientId - The ID of the patient.
 * @param dataPipelineRequestId - The ID of the data pipeline request.
 * @param rerunPdOnNewDemographics - Whether to rerun patient discovery on new demographics.
 * @param context - The context of the patient discovery query.
 * @throws MetriportError if the patient discovery query fails.
 */
export async function startPatientQuery({
  cxId,
  patientId,
  dataPipelineRequestId,
  rerunPdOnNewDemographics,
  context,
}: {
  cxId: string;
  patientId: string;
  dataPipelineRequestId: string;
  rerunPdOnNewDemographics?: boolean | undefined;
  context: string;
}): Promise<{ requestId: string }> {
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const patientUrl = buildPatientDiscoveryUrl(
    cxId,
    patientId,
    dataPipelineRequestId,
    rerunPdOnNewDemographics
  );

  const res = await withDefaultApiErrorHandling({
    functionToRun: () => api.post(patientUrl, {}),
    messageWhenItFails: `Failure while starting patient query @ ${context}`,
    additionalInfo: {
      cxId,
      patientId,
      dataPipelineRequestId,
      patientUrl,
      context: `${context}.startPatientQuery`,
    },
  });

  return { requestId: res.data.requestId };
}

function buildPatientDiscoveryUrl(
  cxId: string,
  patientId: string,
  dataPipelineRequestId: string,
  rerunPdOnNewDemographics?: boolean | undefined
) {
  const urlParams = new URLSearchParams({
    cxId,
    requestId: dataPipelineRequestId,
    ...(rerunPdOnNewDemographics
      ? { rerunPdOnNewDemographics: rerunPdOnNewDemographics.toString() }
      : undefined),
  });
  return `/internal/patient/${patientId}/patient-discovery?${urlParams.toString()}`;
}
