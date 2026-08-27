import { AllergyIntolerance } from "@medplum/fhirtypes";
import { createPracticeFusionClient } from "../../shared";

export async function writeAllergyToFhir({
  cxId,
  practicefusionPatientId,
  practicefusionPracticeId,
  allergyIntolerance,
}: {
  cxId: string;
  practicefusionPatientId: string;
  practicefusionPracticeId: string;
  allergyIntolerance: AllergyIntolerance;
}): Promise<void> {
  const api = await createPracticeFusionClient({ cxId, practiceId: practicefusionPracticeId });
  await api.createAllergyIntolerance({
    cxId,
    patientId: practicefusionPatientId,
    allergyIntolerance,
  });
}
