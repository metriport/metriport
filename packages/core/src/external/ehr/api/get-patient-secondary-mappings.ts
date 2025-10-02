import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { z } from "zod";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { ApiBaseParams, validateAndLogResponse } from "./api-shared";

export type GetPatientSecondaryMappingsParams = Omit<ApiBaseParams, "practiceId" | "departmentId">;

/**
 * Sends a request to the API to get the secondary mappings for a patient.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 * @param schema - The schema to validate the response against.
 */
export async function getPatientSecondaryMappings<T>({
  ehr,
  cxId,
  patientId,
  schema,
}: GetPatientSecondaryMappingsParams & { schema: z.ZodSchema<T> }): Promise<T> {
  const { log, debug } = out(`Ehr getPatientSecondaryMappings - ehr ${ehr} patientId ${patientId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const params = new URLSearchParams({ cxId });
  const getPatientSecondaryMappingsUrl = `/internal/ehr/${ehr}/patient/${patientId}/secondary-mappings?${params.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getPatientSecondaryMappingsUrl);
    });
    validateAndLogResponse(getPatientSecondaryMappingsUrl, response, debug);
    return schema.parse(response.data.secondaryMappings);
  } catch (error) {
    const msg = "Failure while getting patient secondary mappings @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      patientId,
      url: getPatientSecondaryMappingsUrl,
      context: `ehr.getPatientSecondaryMappings`,
    });
  }
}
