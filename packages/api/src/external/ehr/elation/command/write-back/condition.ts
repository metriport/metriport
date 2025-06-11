import { Condition } from "@medplum/fhirtypes";
import { CreatedProblem } from "@metriport/shared/interface/external/ehr/elation/problem";
import { createElationClient } from "../../shared";

export async function writeConditionToChart({
  cxId,
  elationPatientId,
  elationPracticeId,
  condition,
}: {
  cxId: string;
  elationPatientId: string;
  elationPracticeId: string;
  condition: Condition;
}): Promise<CreatedProblem> {
  const api = await createElationClient({ cxId, practiceId: elationPracticeId });
  return await api.createProblem({
    cxId,
    patientId: elationPatientId,
    condition,
  });
}
