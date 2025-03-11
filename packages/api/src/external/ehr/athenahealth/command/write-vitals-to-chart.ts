import { GroupedVitals } from "@metriport/core/external/ehr/athenahealth";
import { CreatedVitalsSuccess } from "@metriport/shared/interface/external/athenahealth/vitals";
import { createAthenaClient } from "../shared";

export async function writeVitalsToChart({
  cxId,
  athenaPatientId,
  athenaPracticeId,
  athenaDepartmentId,
  vitals,
}: {
  cxId: string;
  athenaPatientId: string;
  athenaPracticeId: string;
  athenaDepartmentId: string;
  vitals: GroupedVitals;
}): Promise<CreatedVitalsSuccess[]> {
  const api = await createAthenaClient({ cxId, practiceId: athenaPracticeId });
  return await api.createVitals({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    vitals,
  });
}
