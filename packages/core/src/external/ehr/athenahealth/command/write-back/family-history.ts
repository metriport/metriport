import { WriteBackFamilyHistoryClientRequest } from "../../../command/write-back/family-history";
import { createAthenaHealthClient } from "../../shared";
import { getAndCheckAthenaPatientDepartmentId } from "../get-and-check-patient-department-id";

export async function writeBackFamilyHistory(
  params: WriteBackFamilyHistoryClientRequest
): Promise<void> {
  const { cxId, practiceId, ehrPatientId, tokenInfo, familyHistory } = params;
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
  await client.createFamilyHistory({
    cxId,
    patientId: ehrPatientId,
    departmentId,
    familyHistory,
  });
}
