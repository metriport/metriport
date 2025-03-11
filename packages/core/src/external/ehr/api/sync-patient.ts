import { errorToString, MetriportError } from "@metriport/shared";
import { EhrSource } from "@metriport/shared/src/interface/external/ehr/source";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";

// TODO 2330 add TSDoc
export async function syncPatient({
  ehr,
  cxId,
  practiceId,
  patientId,
  triggerDq,
}: {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  patientId: string;
  triggerDq: boolean;
}): Promise<void> {
  const { log, debug } = out(`PatientImport createPatient - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    practiceId,
    patientId,
    triggerDq: triggerDq.toString(),
  });
  const syncPatientUrl = `/internal/ehr/${ehr}/patient?${queryParams.toString()}`;
  try {
    const response = await api.post(syncPatientUrl);
    if (!response.data) throw new Error(`No body returned from ${syncPatientUrl}`);
    debug(`${syncPatientUrl} resp: ${JSON.stringify(response.data)}`);
  } catch (error) {
    const msg = `Failure while syncing patient @ Ehr`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      practiceId,
      patientId,
      triggerDq,
      url: syncPatientUrl,
      context: "ehr.syncPatient",
    });
  }
}
