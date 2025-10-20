import { CreatedClinicalDocumentSuccess } from "@metriport/shared/interface/external/ehr/athenahealth/clinical-document";
import { createAthenaClient, validateDepartmentId } from "../../shared";

export async function writeNoteToChart({
  cxId,
  athenaPatientId,
  athenaPracticeId,
  athenaDepartmentId,
  encounterText,
  date,
}: {
  cxId: string;
  athenaPatientId: string;
  athenaPracticeId: string;
  athenaDepartmentId: string;
  encounterText: string;
  date: string;
}): Promise<CreatedClinicalDocumentSuccess> {
  await validateDepartmentId({ cxId, athenaPracticeId, athenaPatientId, athenaDepartmentId });
  const api = await createAthenaClient({ cxId, practiceId: athenaPracticeId });
  return await api.createClinicalDocument({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    encounterText,
    date,
  });
}
