import { PatientJob } from "@metriport/shared/domain/job/patient-job";

export type GetJobsRequest = Partial<
  Pick<PatientJob, "id" | "cxId" | "patientId" | "jobType" | "status">
> & {
  runDate?: Date;
};

export interface GetJobsHandler {
  getJobs(request: GetJobsRequest): Promise<void>;
}
