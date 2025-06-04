import { MedicationWithRefs } from "@metriport/core/external/ehr/shared";
import { CreatedMedicationSuccess } from "@metriport/shared/interface/external/ehr/athenahealth/medication";
import { createAthenaClient } from "../../shared";

export async function writeMedicationToChart({
  cxId,
  athenaPatientId,
  athenaPracticeId,
  athenaDepartmentId,
  medication,
}: {
  cxId: string;
  athenaPatientId: string;
  athenaPracticeId: string;
  athenaDepartmentId: string;
  medication: MedicationWithRefs;
}): Promise<CreatedMedicationSuccess[]> {
  const api = await createAthenaClient({ cxId, practiceId: athenaPracticeId });
  return await api.createMedication({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    medication,
  });
}
