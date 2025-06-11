import { Immunization } from "@medplum/fhirtypes";
import { createCanvasClient } from "../../shared";

export async function writeImmunizationToFhir({
  cxId,
  canvasPatientId,
  canvasPracticeId,
  canvasPractitionerId,
  immunization,
}: {
  cxId: string;
  canvasPatientId: string;
  canvasPracticeId: string;
  canvasPractitionerId: string;
  immunization: Immunization;
}): Promise<void> {
  const api = await createCanvasClient({ cxId, practiceId: canvasPracticeId });
  await api.createImmunization({
    cxId,
    patientId: canvasPatientId,
    practitionerId: canvasPractitionerId,
    immunization,
  });
}
