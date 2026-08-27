import { MedicationWithRefs } from "@metriport/core/external/ehr/shared";
import { createHealthieClient } from "../../shared";

export async function writeMedicationToFhir({
  cxId,
  healthiePatientId,
  healthiePracticeId,
  medicationWithRefs,
}: {
  cxId: string;
  healthiePatientId: string;
  healthiePracticeId: string;
  medicationWithRefs: MedicationWithRefs;
}): Promise<void> {
  const api = await createHealthieClient({ cxId, practiceId: healthiePracticeId });
  await api.createMedication({
    cxId,
    patientId: healthiePatientId,
    medicationWithRefs,
  });
}
