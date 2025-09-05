import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import {
  isGroupedVitalsByCode,
  WriteBackGroupedVitalsClientRequest,
} from "../../../command/write-back/grouped-vitals";
import { createAthenaHealthClient } from "../../shared";
import { getAndCheckAthenaPatientDepartmentId } from "../get-and-check-patient-department-id";

export async function writeBackGroupedVitals(
  params: WriteBackGroupedVitalsClientRequest
): Promise<void> {
  const { cxId, practiceId, ehrPatientId, tokenInfo, groupedVitals } = params;
  if (!isGroupedVitalsByCode(groupedVitals)) {
    throw new BadRequestError("Invalid grouped vitals", undefined, {
      ehr: EhrSources.athena,
      writeBackResource: "grouped-vitals",
    });
  }
  const departmentId = await getAndCheckAthenaPatientDepartmentId({
    cxId,
    practiceId,
    patientId: ehrPatientId,
    ...(tokenInfo ? { tokenInfo } : {}),
  });
  const client = await createAthenaHealthClient({
    cxId,
    practiceId,
    ...(tokenInfo ? { tokenInfo } : {}),
  });
  await client.createVitals({
    cxId,
    patientId: ehrPatientId,
    departmentId,
    vitals: groupedVitals,
  });
}
