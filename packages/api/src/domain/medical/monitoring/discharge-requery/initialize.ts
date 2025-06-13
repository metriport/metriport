import { ProcessDischargeRequeryRequest } from "@metriport/core/command/patient-monitoring/discharge-requery/discharge-requery";
import { buildDischargeRequeryHandler } from "@metriport/core/command/patient-monitoring/discharge-requery/discharge-requery-factory";
import { initializePatientJob } from "../../../../command/job/patient/status/initialize";
import { InitializeJobParams } from "../../../../command/job/shared";

export async function runDischargeRequeryJob(props: InitializeJobParams) {
  const { jobId, cxId } = props;

  const patientJob = await initializePatientJob({ jobId, cxId });

  const connector = buildDischargeRequeryHandler();
  const params: ProcessDischargeRequeryRequest = {
    cxId,
    jobId,
    patientId: patientJob.patientId,
  };
  await connector.processDischargeRequery(params);
}
