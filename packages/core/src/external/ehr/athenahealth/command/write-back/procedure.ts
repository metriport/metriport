import { WriteBackProcedureClientRequest } from "../../../command/write-back/procedure";
import { createAthenaHealthClient } from "../../shared";
import { getAndCheckAthenaPatientDepartmentId } from "../get-and-check-patient-department-id";

export async function writeBackProcedure(params: WriteBackProcedureClientRequest): Promise<void> {
  const { cxId, practiceId, ehrPatientId, tokenInfo, procedure } = params;
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
  await client.createSurgicalHistory({
    cxId,
    patientId: ehrPatientId,
    departmentId,
    procedure,
  });
}
