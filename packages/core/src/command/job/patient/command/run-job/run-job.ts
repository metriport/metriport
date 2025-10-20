import { PatientJob } from "@metriport/shared/domain/job/patient-job";

export type RunJobRequest = Pick<PatientJob, "id" | "cxId"> & {
  runUrl: string;
};

export interface RunJobHandler {
  runJob(request: RunJobRequest): Promise<void>;
}
