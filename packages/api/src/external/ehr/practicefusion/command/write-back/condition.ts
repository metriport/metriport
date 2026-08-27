import { Condition } from "@medplum/fhirtypes";
import { createPracticeFusionClient } from "../../shared";

export async function writeConditionToFhir({
  cxId,
  practicefusionPatientId,
  practicefusionPracticeId,
  condition,
}: {
  cxId: string;
  practicefusionPatientId: string;
  practicefusionPracticeId: string;
  condition: Condition;
}): Promise<void> {
  const api = await createPracticeFusionClient({ cxId, practiceId: practicefusionPracticeId });
  await api.createCondition({
    cxId,
    patientId: practicefusionPatientId,
    condition,
  });
}
