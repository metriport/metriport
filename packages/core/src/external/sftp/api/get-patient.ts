import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios, { AxiosInstance } from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { validateAndLogResponse } from "./shared";
import { z } from "zod";

interface GetPatientParams {
  cxId: string;
  patientId: string;
}

const patientSchema = z.object({
  id: z.string(),
  facilityIds: z.array(z.string()),
  firstName: z.string(),
  lastName: z.string(),
  dob: z.string(),
  genderAtBirth: z.enum(["M", "F", "O", "U"]),
  address: z.array(
    z.object({
      addressLine1: z.string().optional(),
      addressLine2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string(),
    })
  ),
});

export type GetPatientResponse = z.infer<typeof patientSchema>;

/**
 * Sends a request to the API to get a patient with Metriport.
 *
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 */
export async function getPatient(
  { cxId, patientId }: GetPatientParams,
  axiosInstance?: AxiosInstance
) {
  const { log, debug } = out(`Surescripts getPatient - cxId ${cxId}`);
  const api = axiosInstance ?? axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const getPatientUrl = `/internal/patient/${patientId}?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getPatientUrl);
    });
    const result = validateAndLogResponse<GetPatientResponse>({
      url: getPatientUrl,
      response,
      schema: patientSchema,
      debug,
    });
    return result;
  } catch (error) {
    const msg = "Failure while syncing patient @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      patientId,
      url: getPatientUrl,
      context: "surescripts.getPatient",
    });
  }
}
