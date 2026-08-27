import { AllergyIntolerance } from "@medplum/fhirtypes";
import { createHealthieClient } from "../../shared";

export async function writeAllergyToFhir({
  cxId,
  healthiePatientId,
  healthiePracticeId,
  allergyIntolerance,
}: {
  cxId: string;
  healthiePatientId: string;
  healthiePracticeId: string;
  allergyIntolerance: AllergyIntolerance;
}): Promise<void> {
  const api = await createHealthieClient({ cxId, practiceId: healthiePracticeId });
  await api.createAllergyIntolerance({
    cxId,
    patientId: healthiePatientId,
    allergyIntolerance,
  });
}
