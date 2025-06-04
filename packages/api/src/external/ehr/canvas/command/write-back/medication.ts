import { MedicationWithRefs } from "@metriport/core/external/ehr/shared";
import { createCanvasClient } from "../../shared";

export async function writeMedicationToFhir({
  cxId,
  canvasPatientId,
  canvasPracticeId,
  canvasPractitionerId,
  medication,
}: {
  cxId: string;
  canvasPatientId: string;
  canvasPracticeId: string;
  canvasPractitionerId: string;
  medication: MedicationWithRefs;
}): Promise<void> {
  const api = await createCanvasClient({ cxId, practiceId: canvasPracticeId });
  await api.createMedicationStatement({
    cxId,
    patientId: canvasPatientId,
    practitionerId: canvasPractitionerId,
    medicationRef: medication,
  });
}
