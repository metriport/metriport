import { MedicationWithRefs } from "@metriport/core/external/athenahealth/index";
import { MedicationCreateResponse } from "@metriport/shared/interface/external/athenahealth/medication";
import { createAthenaClient } from "../shared";

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
}): Promise<MedicationCreateResponse> {
  const api = await createAthenaClient({ cxId, practiceId: athenaPracticeId });
  return await api.createMedication({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    medication,
  });
}
