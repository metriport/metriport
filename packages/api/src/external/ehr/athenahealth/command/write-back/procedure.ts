import { Procedure } from "@medplum/fhirtypes";
import { CreatedSurgicalHistorySuccess } from "@metriport/shared/interface/external/ehr/athenahealth/surgical-history";
import { createAthenaClient } from "../../shared";

export async function writeProcedureToChart({
  cxId,
  athenaPatientId,
  athenaPracticeId,
  athenaDepartmentId,
  procedure,
}: {
  cxId: string;
  athenaPatientId: string;
  athenaPracticeId: string;
  athenaDepartmentId: string;
  procedure: Procedure;
}): Promise<CreatedSurgicalHistorySuccess> {
  const api = await createAthenaClient({ cxId, practiceId: athenaPracticeId });
  return await api.createSurgicalHistory({
    cxId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    procedure,
  });
}
