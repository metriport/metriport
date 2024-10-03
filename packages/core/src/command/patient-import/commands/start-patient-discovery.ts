import axios from "axios";
import { errorToString } from "@metriport/shared";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";

export async function startPatientDiscovery({
  cxId,
  facilityId,
  patientId,
  rerunPdOnNewDemographics,
}: {
  cxId: string;
  facilityId: string;
  patientId: string;
  rerunPdOnNewDemographics: boolean;
}): Promise<void> {
  const { log, debug } = out(
    `PatientImport start patient discovery - cxId ${cxId} patientId ${patientId}`
  );
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = `cxId=${cxId}&facilityId=${facilityId}&rerunPdOnNewDemographics=${rerunPdOnNewDemographics}`;
  const patientUrl = `/internal/patient/${patientId}/patient-discovery?${queryParams}`;
  try {
    const response = await api.post(patientUrl, {});
    if (!response.data) throw new Error(`No body returned from ${patientUrl}`);
    debug(`${patientUrl} resp: ${JSON.stringify(response.data)}`);
  } catch (error) {
    const msg = `Failure while starting patient discovery @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        url: patientUrl,
        cxId,
        patientId,
        context: "patient-import.start-patient-discovery",
        error,
      },
    });
    throw error;
  }
}
