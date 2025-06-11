import { AllergyIntolerance } from "@medplum/fhirtypes";
import { createCanvasClient } from "../../shared";

export async function writeAllergyToFhir({
  cxId,
  canvasPatientId,
  canvasPracticeId,
  canvasPractitionerId,
  allergyIntolerance,
}: {
  cxId: string;
  canvasPatientId: string;
  canvasPracticeId: string;
  canvasPractitionerId: string;
  allergyIntolerance: AllergyIntolerance;
}): Promise<void> {
  const api = await createCanvasClient({ cxId, practiceId: canvasPracticeId });
  await api.createAllergyIntolerance({
    cxId,
    patientId: canvasPatientId,
    practitionerId: canvasPractitionerId,
    allergyIntolerance,
  });
}
