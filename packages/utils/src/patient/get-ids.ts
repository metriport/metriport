import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { Axios } from "axios";

export type GetPatientIdsCmd = { cxId: string; patientIds: string[]; axios: Axios };

const apiUrl = getEnvVarOrFail("API_URL");

export async function getPatientIds(
  cmd: GetPatientIdsCmd
): Promise<{ patientIds: string[]; isAllPatients: boolean }> {
  const { patientIds } = cmd;
  if (patientIds.length > 0) {
    return { patientIds, isAllPatients: false };
  }
  const allPatientIds = await getAllPatientIds(cmd);
  return { patientIds: allPatientIds, isAllPatients: true };
}

export async function getAllPatientIds({ axios, cxId }: GetPatientIdsCmd): Promise<string[]> {
  const resp = await axios.get(`${apiUrl}/internal/patient/ids?cxId=${cxId}`);
  const patientIds = resp.data.patientIds;
  return (Array.isArray(patientIds) ? patientIds : []) as string[];
}
