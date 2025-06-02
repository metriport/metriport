import { Immunization } from "@medplum/fhirtypes";
import { CreatedVaccinesSuccess } from "@metriport/shared/interface/external/ehr/athenahealth/vaccine";
import { createAthenaClient } from "../../shared";

export async function writeImmunizationToChart({
  cxId,
  athenaPatientId,
  athenaPracticeId,
  athenaDepartmentId,
  immunization,
}: {
  cxId: string;
  athenaPatientId: string;
  athenaPracticeId: string;
  athenaDepartmentId: string;
  immunization: Immunization;
}): Promise<CreatedVaccinesSuccess> {
  const api = await createAthenaClient({ cxId, practiceId: athenaPracticeId });
  return await api.createVaccine({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    immunization,
  });
}
