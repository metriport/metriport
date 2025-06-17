import { PatientJob } from "@metriport/shared/domain/job/patient-job";

export type TriggerJobsRequest = Partial<
  Pick<PatientJob, "cxId" | "patientId" | "jobType" | "jobGroupId" | "status">
> & {
  scheduledBefore?: Date;
};

export interface TriggerJobsHandler {
  triggerJobs(request: TriggerJobsRequest): Promise<void>;
}
