import axios from "axios";
import { errorToString, patientSchema } from "@metriport/shared";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";
import { PatientPayload } from "../bulk-upload";

export async function createPatient({
  cxId,
  facilityId,
  patient,
}: {
  cxId: string;
  facilityId: string;
  patient: PatientPayload;
}): Promise<string> {
  const { log, debug } = out(`BulkUpload create patient - cxId ${cxId} facilityId ${facilityId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const patientUrl = `/internal/patient?cxId=${cxId}&facilityId=${facilityId}`;
  try {
    const response = await api.post(patientUrl, patient);
    if (!response.data) throw new Error(`No body returned from ${patientUrl}`);
    debug(`${patientUrl} resp: ${JSON.stringify(response.data)}`);
    return patientSchema.parse(patientSchema).id;
  } catch (error) {
    const msg = `Failure while creating patient @ BulkUpload`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        url: patientUrl,
        cxId,
        facilityId,
        context: "bulk-upload.create-patient",
        error,
      },
    });
    throw error;
  }
}
