import { Condition } from "@medplum/fhirtypes";
import AthenaHealthApi from "@metriport/core/external/athenahealth/index";
import { ProblemCreateResponse } from "@metriport/shared/interface/external/athenahealth/problem";
import { getAthenaEnv } from "../shared";

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
}): Promise<ProblemCreateResponse> {
  const { environment, clientKey, clientSecret } = await getAthenaEnv();

  const api = await AthenaHealthApi.create({
    practiceId: athenaPracticeId,
    environment,
    clientKey,
    clientSecret,
  });
  return await api.createProblem({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    condition,
  });
}
