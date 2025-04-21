import { errorToString, MetriportError } from "@metriport/shared";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";

export type SyncPatientParams = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  departmentId?: string;
  patientId: string;
  triggerDq: boolean;
};

/**
 * Sends a request to the API to sync a patient with Metriport.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice ID.
 * @param patientId - The patient ID.
 * @param triggerDq - Whether to trigger DQ.
 */
export async function syncPatient({
  ehr,
  cxId,
  practiceId,
  departmentId,
  patientId,
  triggerDq,
}: SyncPatientParams): Promise<void> {
  const { log, debug } = out(`Ehr syncPatient - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    practiceId,
    patientId,
    triggerDq: triggerDq.toString(),
    ...(departmentId ? { departmentId } : {}),
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
