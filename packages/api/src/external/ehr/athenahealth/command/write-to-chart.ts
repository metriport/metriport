import AthenaHealthApi, { MedicationWithRefs } from "@metriport/core/external/athenahealth/index";
import { getAthenaEnv } from "../shared";

export async function writeMedicationToChart({
  cxId,
  athenaPatientId,
  athenaPracticeId,
  athenaDepartmentId,
  medication,
  accessToken,
}: {
  cxId: string;
  athenaPatientId: string;
  athenaPracticeId: string;
  athenaDepartmentId: string;
  medication: MedicationWithRefs;
  accessToken?: string;
}) {
  const { environment, clientKey, clientSecret } = await getAthenaEnv();

  const api = await AthenaHealthApi.create({
    threeLeggedAuthToken: accessToken,
    practiceId: athenaPracticeId,
    environment,
    clientKey,
    clientSecret,
  });
  await api.createMedication({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    medication,
  });
}
