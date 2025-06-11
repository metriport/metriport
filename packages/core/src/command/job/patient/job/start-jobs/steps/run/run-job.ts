import { PatientJob } from "@metriport/shared/domain/job/patient-job";

export type RunJobRequest = Pick<PatientJob, "id" | "cxId" | "jobType"> &
  Partial<Pick<PatientJob, "paramsCx" | "paramsOps" | "data">>;

export interface RunJobHandler {
  runJob(request: RunJobRequest): Promise<void>;
}
