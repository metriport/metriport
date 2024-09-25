import AthenaHealthApi, {
  AthenaEnv,
  MedicationWithRefs,
} from "@metriport/core/external/athenahealth/index";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import { Config } from "../../../../shared/config";

const region = Config.getAWSRegion();
const athenaEnvironment = Config.getAthenaHealthEnv();
const athenaClientKeySecretArn = Config.getAthenaHealthClientKeyArm();
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
  if (!athenaEnvironment || !athenaClientKeySecretArn || !athenaClientSecretSecretArn) {
    throw new Error("AthenaHealth not setup");
  }
  const athenaClientKey = await getSecretValueOrFail(athenaClientKeySecretArn, region);
  const athenaClientSecret = await getSecretValueOrFail(athenaClientSecretSecretArn, region);
  const api = await AthenaHealthApi.create({
    threeLeggedAuthToken: accessToken,
    practiceId: athenaPracticeId,
    environment: athenaEnvironment as AthenaEnv,
    clientKey: athenaClientKey,
    clientSecret: athenaClientSecret,
  });
  await api.createMedication({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    medication,
  });
}
