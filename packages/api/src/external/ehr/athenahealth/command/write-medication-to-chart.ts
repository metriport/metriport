import AthenaHealthApi, { MedicationWithRefs } from "@metriport/core/external/athenahealth/index";
import { MedicationCreateResponse } from "@metriport/shared/interface/external/athenahealth/medication";
import { getAthenaEnv } from "../shared";

export async function writeMedicationToChart({
  cxId,
  athenaPatientId,
  athenaPracticeId,
  athenaDepartmentId,
  medication,
}: {
  cxId: string;
  athenaPatientId: string;
  athenaPracticeId: string;
  athenaDepartmentId: string;
  medication: MedicationWithRefs;
}): Promise<MedicationCreateResponse> {
  const { environment, clientKey, clientSecret } = await getAthenaEnv();

  const api = await AthenaHealthApi.create({
    threeLeggedAuthToken: undefined,
    practiceId: athenaPracticeId,
    environment,
    clientKey,
    clientSecret,
  });
  return await api.createMedication({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    medication,
  });
}
