import { Resource } from "@medplum/fhirtypes";
//import { out } from "@metriport/core/util/log";
import { writeMedicationToChart as writeMedicationToAthenaChart } from "@metriport/core/external/athenahealth/write-fhir-resource";
import { Config } from "../../../../shared/config";

const athenaUrl = Config.getAthenaHealthUrl();

export async function writeMedicationToChart({
  accessToken,
  cxId,
  athenaPatientId,
  athenaPracticeId,
  athenaDepartmentId,
  medication,
}: {
  accessToken: string;
  cxId: string;
  athenaPatientId: string;
  athenaPracticeId: string;
  athenaDepartmentId: string;
  medication: Resource;
}) {
  //const { log } = out(`AthenaHealth writeMedicationToChart - cxId ${cxId} athenaPatientId ${athenaPatientId}`);
  if (!athenaUrl) throw new Error("AthenaHealth url not defined");
  if (medication.resourceType !== "Medication") throw new Error("Resource type not Medication");
  await writeMedicationToAthenaChart({
    cxId,
    accessToken: accessToken,
    baseUrl: "https://api.preview.platform.athenahealth.com",
    patientId: athenaPatientId,
    practiceId: athenaPracticeId,
    departmentId: athenaDepartmentId,
    medication,
  });
}
