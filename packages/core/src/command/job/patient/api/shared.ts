import { PatientJob } from "@metriport/shared/domain/job/patient-job";

type JobId = PatientJob["id"];

export type JobBaseParams = Pick<PatientJob, "cxId"> & { jobId: JobId };
