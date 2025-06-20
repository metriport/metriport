import { Condition } from "@medplum/fhirtypes";
import { createCanvasClient } from "../../shared";

export async function writeConditionToFhir({
  cxId,
  canvasPatientId,
  canvasPracticeId,
  canvasPractitionerId,
  condition,
}: {
  cxId: string;
  canvasPatientId: string;
  canvasPracticeId: string;
  canvasPractitionerId: string;
  condition: Condition;
}): Promise<void> {
  const api = await createCanvasClient({ cxId, practiceId: canvasPracticeId });
  await api.createCondition({
    cxId,
    patientId: canvasPatientId,
    practitionerId: canvasPractitionerId,
    condition,
  });
}
