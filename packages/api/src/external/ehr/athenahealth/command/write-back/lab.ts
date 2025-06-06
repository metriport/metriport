import { Observation } from "@medplum/fhirtypes";
import { CreatedLabResultSuccess } from "@metriport/shared/interface/external/ehr/athenahealth/lab-result";
import { createAthenaClient } from "../../shared";

export async function writeLabToChart({
  cxId,
  athenaPatientId,
  athenaPracticeId,
  athenaDepartmentId,
  observation,
}: {
  cxId: string;
  athenaPatientId: string;
  athenaPracticeId: string;
  athenaDepartmentId: string;
  observation: Observation;
}): Promise<CreatedLabResultSuccess> {
  const api = await createAthenaClient({ cxId, practiceId: athenaPracticeId });
  return await api.createLabResultDocument({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    observation,
  });
}
