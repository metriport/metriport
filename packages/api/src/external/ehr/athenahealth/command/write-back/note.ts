import { CreatedEncounterSuccess } from "@metriport/shared/interface/external/ehr/athenahealth/encounter";
import { createAthenaClient } from "../../shared";

export async function writeNoteToChart({
  cxId,
  athenaPatientId,
  athenaPracticeId,
  athenaDepartmentId,
  encounterText,
}: {
  cxId: string;
  athenaPatientId: string;
  athenaPracticeId: string;
  athenaDepartmentId: string;
  encounterText: string;
}): Promise<CreatedEncounterSuccess> {
  const api = await createAthenaClient({ cxId, practiceId: athenaPracticeId });
  return await api.createEncounterDocument({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    encounterText,
  });
}
