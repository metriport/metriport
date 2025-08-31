import { WriteBackLabClientRequest } from "../../../command/write-back/lab";
import { createAthenaHealthClient } from "../../shared";
import { getAndCheckAthenaPatientDepartmentId } from "../get-and-check-patient-department-id";

export async function writeBackLab(params: WriteBackLabClientRequest): Promise<void> {
  const { cxId, practiceId, ehrPatientId, tokenInfo, observation } = params;
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
  await client.createLabResultDocument({
    cxId,
    patientId: ehrPatientId,
    departmentId,
    observation,
  });
}
