import { ProcessDischargeRequeryRequest } from "@metriport/core/command/patient-monitoring/discharge-requery/discharge-requery";
import { buildDischargeRequeryHandler } from "@metriport/core/command/patient-monitoring/discharge-requery/discharge-requery-factory";
import {
  InitializeJobParams,
  initializePatientJob,
} from "../../../../command/job/patient/status/initialize";

export async function runDischargeRequeryJob(props: InitializeJobParams): Promise<void> {
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
