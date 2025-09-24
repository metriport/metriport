import { WriteBackAllergyClientRequest } from "../../../command/write-back/allergy";
import { createAthenaHealthClient } from "../../shared";
import { getAndCheckAthenaPatientDepartmentId } from "../get-and-check-patient-department-id";

export async function writeBackAllergy(params: WriteBackAllergyClientRequest): Promise<void> {
  const { cxId, practiceId, ehrPatientId, tokenInfo, allergyIntolerance } = params;
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
  await client.createAllergy({
    cxId,
    patientId: ehrPatientId,
    departmentId,
    allergyIntolerance,
  });
}
