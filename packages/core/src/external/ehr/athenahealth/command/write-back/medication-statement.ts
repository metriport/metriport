import { WriteBackMedicationStatementClientRequest } from "../../../command/write-back/medication-statement";
import { createMedicationWithRefs } from "../../../shared";
import { createAthenaHealthClient } from "../../shared";
import { getAndCheckAthenaPatientDepartmentId } from "../get-and-check-patient-department-id";

export async function writeBackMedicationStatement(
  params: WriteBackMedicationStatementClientRequest
): Promise<void> {
  const { cxId, practiceId, ehrPatientId, tokenInfo, medication, statements } = params;
  const medicationWithRefs = createMedicationWithRefs(medication, statements);
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
  await client.createMedicationWithStatements({
    cxId,
    patientId: ehrPatientId,
    departmentId,
    medicationWithRefs,
  });
}
