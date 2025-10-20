import { GroupedVitals } from "@metriport/core/external/ehr/shared";
import { createCanvasClient } from "../../shared";

export async function writeVitalsToFhir({
  cxId,
  canvasPatientId,
  canvasPracticeId,
  canvasPractitionerId,
  vitals,
}: {
  cxId: string;
  canvasPatientId: string;
  canvasPracticeId: string;
  canvasPractitionerId: string;
  vitals: GroupedVitals;
}): Promise<void> {
  const api = await createCanvasClient({ cxId, practiceId: canvasPracticeId });
  await api.createVitals({
    cxId,
    patientId: canvasPatientId,
    practitionerId: canvasPractitionerId,
    vitals,
  });
}
