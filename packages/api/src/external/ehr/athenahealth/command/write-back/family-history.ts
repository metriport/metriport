import { FamilyMemberHistory } from "@medplum/fhirtypes";
import { CreatedFamilyHistorySuccess } from "@metriport/shared/interface/external/ehr/athenahealth/family-history";
import { createAthenaClient, validateDepartmentId } from "../../shared";

export async function writeFamilyHistoryToChart({
  cxId,
  athenaPatientId,
  athenaPracticeId,
  athenaDepartmentId,
  familyHistory,
}: {
  cxId: string;
  athenaPatientId: string;
  athenaPracticeId: string;
  athenaDepartmentId: string;
  familyHistory: FamilyMemberHistory;
}): Promise<CreatedFamilyHistorySuccess> {
  await validateDepartmentId({ cxId, athenaPracticeId, athenaPatientId, athenaDepartmentId });
  const api = await createAthenaClient({ cxId, practiceId: athenaPracticeId });
  return await api.createFamilyHistory({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    familyHistory,
  });
}
