import axios from "axios";
import { errorToString } from "@metriport/shared";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";

export async function startPatientQuery({
  cxId,
  patientId,
  rerunPdOnNewDemographics,
}: {
  cxId: string;
  patientId: string;
  rerunPdOnNewDemographics: boolean;
}): Promise<void> {
  const { log, debug } = out(
    `PatientImport start patient query - cxId ${cxId} patientId ${patientId}`
  );
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const patientUrl = `/internal/patient/${patientId}/patient-discovery?cxId=${cxId}&rerunPdOnNewDemographics=${rerunPdOnNewDemographics}`;
  try {
    const response = await api.post(patientUrl, {});
    if (!response.data) throw new Error(`No body returned from ${patientUrl}`);
    debug(`${patientUrl} resp: ${JSON.stringify(response.data)}`);
  } catch (error) {
    const msg = `Failure while starting patient query @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        url: patientUrl,
        cxId,
        patientId,
        rerunPdOnNewDemographics,
        context: "patient-import.start-patient-query",
        error,
      },
    });
    throw error;
  }
}
