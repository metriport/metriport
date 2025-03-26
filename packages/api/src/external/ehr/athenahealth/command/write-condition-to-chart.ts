import { Condition } from "@medplum/fhirtypes";
import { CreatedProblemSuccess } from "@metriport/shared/interface/external/ehr/athenahealth/problem";
import { createAthenaClient } from "../shared";

export async function writeConditionToChart({
  cxId,
  athenaPatientId,
  athenaPracticeId,
  athenaDepartmentId,
  condition,
}: {
  cxId: string;
  athenaPatientId: string;
  athenaPracticeId: string;
  athenaDepartmentId: string;
  condition: Condition;
}): Promise<CreatedProblemSuccess> {
  const api = await createAthenaClient({ cxId, practiceId: athenaPracticeId });
  return await api.createProblem({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    condition,
  });
}
