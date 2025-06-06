import { AllergyIntolerance } from "@medplum/fhirtypes";
import { createAthenaClient } from "../../shared";
import { CreatedAllergySuccess } from "@metriport/shared/interface/external/ehr/athenahealth/allergy";

export async function writeAllergyToChart({
  cxId,
  athenaPatientId,
  athenaPracticeId,
  athenaDepartmentId,
  allergyIntolerance,
}: {
  cxId: string;
  athenaPatientId: string;
  athenaPracticeId: string;
  athenaDepartmentId: string;
  allergyIntolerance: AllergyIntolerance;
}): Promise<CreatedAllergySuccess> {
  const api = await createAthenaClient({ cxId, practiceId: athenaPracticeId });
  return await api.createAllergy({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    allergyIntolerance,
  });
}
