import AthenaHealthApi, { GroupedVitals } from "@metriport/core/external/athenahealth/index";
import { VitalsCreateResponse } from "@metriport/shared/interface/external/athenahealth/vitals";
import { getAthenaEnv } from "../shared";

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
  const { environment, clientKey, clientSecret } = await getAthenaEnv();

  const api = await AthenaHealthApi.create({
    threeLeggedAuthToken: undefined,
    practiceId: athenaPracticeId,
    environment,
    clientKey,
    clientSecret,
  });
  return await api.createVitals({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    vitals,
  });
}
