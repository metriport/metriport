import { MedicationWithRefs } from "@metriport/core/external/ehr/shared";
import { createCanvasClient } from "../../shared";

export async function writeMedicationToFhir({
  cxId,
  canvasPatientId,
  canvasPracticeId,
  canvasPractitionerId,
  medicationWithRefs,
}: {
  cxId: string;
  canvasPatientId: string;
  canvasPracticeId: string;
  canvasPractitionerId: string;
  medicationWithRefs: MedicationWithRefs;
}): Promise<void> {
  const api = await createCanvasClient({ cxId, practiceId: canvasPracticeId });
  await api.createMedicationStatements({
    cxId,
    patientId: canvasPatientId,
    practitionerId: canvasPractitionerId,
    medicationWithRefs,
  });
}
