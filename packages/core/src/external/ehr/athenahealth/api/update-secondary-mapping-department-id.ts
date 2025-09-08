import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { validateAndLogResponse } from "../../api/api-shared";

export type UpdateAthenaPatientSecondaryMappingDepartmentIdParams = {
  cxId: string;
  athenaPatientId: string;
  athenaDepartmentId: string;
};

/**
 * Updates the department ID in the secondary mappings for an AthenaHealth patient mapping
 * by calling the internal API route.
 *
 * @param cxId - The CX ID.
 * @param athenaPatientId - The AthenaHealth patient ID.
 * @param athenaDepartmentId - The AthenaHealth department ID.
 */
export async function updateAthenaPatientSecondaryMappingDepartmentId({
  cxId,
  athenaPatientId,
  athenaDepartmentId,
}: UpdateAthenaPatientSecondaryMappingDepartmentIdParams): Promise<void> {
  const { log, debug } = out(
    `Athena updateAthenaPatientSecondaryMappingDepartmentId - cxId ${cxId} athenaPatientId ${athenaPatientId} athenaDepartmentId ${athenaDepartmentId}`
  );
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const params = new URLSearchParams({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
  });
  const url = `/internal/ehr/athenahealth/patient/secondary-mappings/department-id?${params.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(url);
    });
    validateAndLogResponse(url, response, debug);
  } catch (error) {
    const msg = "Failure while updating AthenaHealth patient secondary mapping department ID @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      athenaPatientId,
      athenaDepartmentId,
      url,
      context: `athenahealth.updateAthenaPatientSecondaryMappingDepartmentId`,
    });
  }
}
