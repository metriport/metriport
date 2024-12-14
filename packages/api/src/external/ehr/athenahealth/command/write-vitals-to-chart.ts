import { GroupedVitals } from "@metriport/core/external/athenahealth/index";
import { VitalsCreateResponse } from "@metriport/shared/interface/external/athenahealth/vitals";
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
}): Promise<VitalsCreateResponse[]> {
  const api = await createAthenaClient({ cxId, practiceId: athenaPracticeId });
  return await api.createVitals({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    vitals,
  });
}
