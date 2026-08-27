import { MedicationWithRefs } from "@metriport/core/external/ehr/shared";
import { createPracticeFusionClient } from "../../shared";

export async function writeMedicationToFhir({
  cxId,
  practicefusionPatientId,
  practicefusionPracticeId,
  medicationWithRefs,
}: {
  cxId: string;
  practicefusionPatientId: string;
  practicefusionPracticeId: string;
  medicationWithRefs: MedicationWithRefs;
}): Promise<void> {
  const api = await createPracticeFusionClient({ cxId, practiceId: practicefusionPracticeId });
  await api.createMedicationRequest({
    cxId,
    patientId: practicefusionPatientId,
    medicationWithRefs,
  });
}
