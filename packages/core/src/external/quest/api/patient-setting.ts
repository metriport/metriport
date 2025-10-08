import { errorToString, executeWithNetworkRetries, NotFoundError } from "@metriport/shared";
import axios, { AxiosInstance } from "axios";
import { z } from "zod";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { QuestPatientRequest } from "../types";

const patientSettingsResponseSchema = z.object({
  patientsFoundAndUpdated: z.number(),
  patientsNotFound: z.array(z.string()),
  failedCount: z.number().optional(),
  failedIds: z.array(z.string()).optional(),
});

export type PatientSettingsResponse = z.infer<typeof patientSettingsResponseSchema>;

/**
 * Sets Quest-related patient subscriptions for a given patient.
 */
export async function setPatientSetting(
  { cxId, patientId, backfill, notifications }: QuestPatientRequest,
  axiosInstance?: AxiosInstance
): Promise<PatientSettingsResponse> {
  const { log } = out(`Quest setPatientSetting - cxId ${cxId} - patientId ${patientId}`);
  const api = axiosInstance ?? axios.create({ baseURL: Config.getApiUrl() });
  const getPatientMappingUrl = `/internal/patient/settings/quest`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(getPatientMappingUrl, {
        patientIds: [patientId],
        backfill,
        notifications,
      });
    });
    const data = patientSettingsResponseSchema.parse(response.data);
    return data;
  } catch (error) {
    const msg = "Failure while getting patient mapping @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new NotFoundError(msg, error, {
      cxId,
      patientId,
      url: getPatientMappingUrl,
      context: "quest.getPatientMapping",
    });
  }
}
