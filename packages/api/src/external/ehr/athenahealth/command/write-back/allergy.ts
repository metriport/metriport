import { AllergyIntolerance } from "@medplum/fhirtypes";
import { CreatedAllergySuccess } from "@metriport/shared/interface/external/ehr/athenahealth/allergy";
import { createAthenaClient, validateDepartmentId } from "../../shared";

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
  await validateDepartmentId({ cxId, athenaPracticeId, athenaPatientId, athenaDepartmentId });
  const api = await createAthenaClient({ cxId, practiceId: athenaPracticeId });
  return await api.createAllergy({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    allergyIntolerance,
  });
}
