import { MedicationWithRefs } from "@metriport/core/external/ehr/shared";
import { CreatedMedicationSuccess } from "@metriport/shared/interface/external/ehr/athenahealth/medication";
import { createAthenaClient } from "../../shared";

export async function writeMedicationToChart({
  cxId,
  athenaPatientId,
  athenaPracticeId,
  athenaDepartmentId,
  medicationWithRefs,
}: {
  cxId: string;
  athenaPatientId: string;
  athenaPracticeId: string;
  athenaDepartmentId: string;
  medicationWithRefs: MedicationWithRefs;
}): Promise<CreatedMedicationSuccess[]> {
  const api = await createAthenaClient({ cxId, practiceId: athenaPracticeId });
  return await api.createMedicationWithStatements({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    medicationWithRefs,
  });
}
