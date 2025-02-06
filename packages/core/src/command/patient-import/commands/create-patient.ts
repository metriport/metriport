import axios from "axios";
import { errorToString, patientCreateResponseSchema } from "@metriport/shared";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";
import { PatientPayload } from "../patient-import";

// TODO 2330 add TSDoc
export async function createPatient({
  cxId,
  facilityId,
  patientPayload,
}: {
  cxId: string;
  facilityId: string;
  patientPayload: PatientPayload;
}): Promise<string> {
  const { log, debug } = out(`PatientImport createPatient - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const patientUrl = `/internal/patient?cxId=${cxId}&facilityId=${facilityId}`;
  try {
    const response = await api.post(patientUrl, patientPayload);
    if (!response.data) throw new Error(`No body returned from ${patientUrl}`);
    debug(`${patientUrl} resp: ${JSON.stringify(response.data)}`);
    return patientCreateResponseSchema.parse(response.data).id;
  } catch (error) {
    const msg = `Failure while creating patient @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        url: patientUrl,
        cxId,
        facilityId,
        context: "patient-import.create-patient",
        error,
      },
    });
    throw error;
  }
}
