import { Medication, MedicationStatement } from "@medplum/fhirtypes";
//import { out } from "@metriport/core/util/log";
import AthenaHealthApi from "@metriport/core/external/athenahealth/index";
import { Config } from "../../../../shared/config";

const athenaEnvironment = Config.getAthenaHealthEnv();
const athenaClientId = Config.getAthenaTwoLeggedClientSecret();
const athenaClientSecret = Config.getAthenaTwoLeggedClientId();

export async function writeMedicationToChart({
  accessToken,
  cxId,
  athenaPatientId,
  athenaPracticeId,
  athenaDepartmentId,
  medication,
  medicationStatement,
}: {
  accessToken: string;
  cxId: string;
  athenaPatientId: string;
  athenaPracticeId: string;
  athenaDepartmentId: string;
  medication: Medication;
  medicationStatement?: MedicationStatement;
}) {
  //const { log } = out(`AthenaHealth writeMedicationToChart - cxId ${cxId} athenaPatientId ${athenaPatientId}`);
  if (!athenaEnvironment || !athenaClientId || !athenaClientSecret) {
    throw new Error("AthenaHealth not setup");
  }
  const api = await AthenaHealthApi.create({
    threeLeggedAuthToken: accessToken,
    practiceId: athenaPracticeId,
    environment: athenaEnvironment as "api" | "api.preview",
    clientId: athenaClientId,
    clientSecret: athenaClientSecret,
  });
  await api.createMedication({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    medication,
    medicationStatement,
  });
}
