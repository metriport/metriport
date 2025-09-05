import { WriteBackConditionClientRequest } from "../../../command/write-back/condition";
import { createAthenaHealthClient } from "../../shared";
import { getAndCheckAthenaPatientDepartmentId } from "../get-and-check-patient-department-id";

export async function writeBackCondition(params: WriteBackConditionClientRequest): Promise<void> {
  const { cxId, practiceId, ehrPatientId, tokenInfo, condition } = params;
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
  await client.createProblem({
    cxId,
    patientId: ehrPatientId,
    departmentId,
    condition,
  });
}
