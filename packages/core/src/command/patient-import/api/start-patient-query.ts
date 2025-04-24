import axios from "axios";
import { Config } from "../../../util/config";
import { withDefaultApiErrorHandling } from "./shared";

/**
 * Starts the patient query for a patient, in the context of a bulk patient import.
 *
 * @param cxId - The ID of the customer.
 * @param patientId - The ID of the patient.
 * @param dataPipelineRequestId - The ID of the data pipeline request.
 * @param rerunPdOnNewDemographics - Whether to rerun patient discovery on new demographics.
 * @throws MetriportError if the patient query fails.
 */
export async function startPatientQuery({
  cxId,
  patientId,
  dataPipelineRequestId,
  rerunPdOnNewDemographics,
}: {
  cxId: string;
  patientId: string;
  dataPipelineRequestId: string;
  rerunPdOnNewDemographics?: boolean | undefined;
}): Promise<void> {
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const patientUrl = buildPatientDiscoveryUrl(
    cxId,
    patientId,
    dataPipelineRequestId,
    rerunPdOnNewDemographics
  );

  await withDefaultApiErrorHandling({
    functionToRun: () => api.post(patientUrl, {}),
    messageWhenItFails: `Failure while starting patient query @ PatientImport`,
    additionalInfo: {
      cxId,
      patientId,
      dataPipelineRequestId,
      patientUrl,
      context: "patient-import.startPatientQuery",
    },
  });
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
