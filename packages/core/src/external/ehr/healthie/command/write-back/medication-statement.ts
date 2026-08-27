import { WriteBackMedicationStatementClientRequest } from "../../../command/write-back/medication-statement";
import { createMedicationWithRefs } from "../../../shared";
import { createHealthieClient } from "../../shared";

export async function writeBackMedicationStatementHealthie(
  params: WriteBackMedicationStatementClientRequest
): Promise<void> {
  const { cxId, practiceId, ehrPatientId, medication, statements } = params;
  const medicationWithRefs = createMedicationWithRefs(medication, statements);
  const client = await createHealthieClient({
    cxId,
    practiceId,
  });
  await client.createMedication({
    cxId,
    patientId: ehrPatientId,
    medicationWithRefs,
  });
}
