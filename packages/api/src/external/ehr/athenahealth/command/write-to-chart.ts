import AthenaHealthApi, { MedicationWithRefs } from "@metriport/core/external/athenahealth/index";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import { MetriportError } from "@metriport/shared";
import { Config } from "../../../../shared/config";
import { getAthenaEnv } from "../shared";

const region = Config.getAWSRegion();
const athenaClientKeySecretArn = Config.getAthenaHealthClientKeyArn();
const athenaClientSecretSecretArn = Config.getAthenaHealthClientSecretArn();

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
  const athenaEnvironment = getAthenaEnv();
  if (!athenaClientKeySecretArn || !athenaClientSecretSecretArn) {
    throw new MetriportError("AthenaHealth not setup");
  }

  const clientKey = await getSecretValueOrFail(athenaClientKeySecretArn, region);
  const clientSecret = await getSecretValueOrFail(athenaClientSecretSecretArn, region);
  const api = await AthenaHealthApi.create({
    threeLeggedAuthToken: accessToken,
    practiceId: athenaPracticeId,
    environment: athenaEnvironment,
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
