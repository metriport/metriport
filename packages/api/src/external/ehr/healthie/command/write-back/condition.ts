import { Condition } from "@medplum/fhirtypes";
import { createHealthieClient } from "../../shared";

export async function writeConditionToFhir({
  cxId,
  healthiePatientId,
  healthiePracticeId,
  condition,
}: {
  cxId: string;
  healthiePatientId: string;
  healthiePracticeId: string;
  condition: Condition;
}): Promise<void> {
  const api = await createHealthieClient({ cxId, practiceId: healthiePracticeId });
  await api.createCondition({
    cxId,
    patientId: healthiePatientId,
    condition,
  });
}
