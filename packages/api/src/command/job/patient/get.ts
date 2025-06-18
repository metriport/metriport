import { JobStatus, NotFoundError, PatientJob } from "@metriport/shared";
import { Op } from "sequelize";
import { PatientJobModel } from "../../../models/patient-job";

export type GetJobByIdParams = {
  cxId: string;
  jobId: string;
};

export async function getPatientJobById(params: GetJobByIdParams): Promise<PatientJob | undefined> {
  const job = await getPatientJobModel(params);
  if (!job) return undefined;
  return job.dataValues;
}

export async function getPatientJobByIdOrFail(params: GetJobByIdParams): Promise<PatientJob> {
  const job = await getPatientJobModel(params);
  if (!job) throw new NotFoundError("Patient Job not found", undefined, { ...params });
  return job.dataValues;
}

export async function getPatientJobModel({
  jobId,
  cxId,
}: GetJobByIdParams): Promise<PatientJobModel | undefined> {
  const job = await PatientJobModel.findOne({ where: { id: jobId, cxId } });
  if (!job) return undefined;
  return job;
}

export async function getPatientJobModelOrFail(params: GetJobByIdParams): Promise<PatientJobModel> {
  const job = await getPatientJobModel(params);
  if (!job) throw new NotFoundError("Patient Job not found", undefined, { ...params });
  return job;
}

export type ListPatientJobsParams = Partial<
  Pick<PatientJob, "cxId" | "patientId" | "jobType" | "jobGroupId">
> & {
  status?: JobStatus | JobStatus[];
  scheduledAfter?: Date;
  scheduledBefore?: Date;
};

export async function getPatientJobs({
  cxId,
  patientId,
  jobType,
  jobGroupId,
  status,
  scheduledAfter,
  scheduledBefore,
}: ListPatientJobsParams): Promise<PatientJob[]> {
  const statuses = getStatusFromParams(status);
  const jobs = await PatientJobModel.findAll({
    where: {
      ...(cxId ? { cxId } : {}),
      ...(patientId ? { patientId } : {}),
      ...(jobType ? { jobType } : {}),
      ...(jobGroupId ? { jobGroupId } : {}),
      ...(statuses.length > 0 ? { status: { [Op.in]: statuses } } : {}),
      ...(scheduledAfter ? { scheduledAt: { [Op.gte]: scheduledAfter } } : {}),
      ...(scheduledBefore ? { scheduledAt: { [Op.lte]: scheduledBefore } } : {}),
    },
  });
  return jobs.map(job => job.dataValues);
}

export type ListLatestPatientJobsParams = Pick<
  PatientJob,
  "cxId" | "patientId" | "jobType" | "jobGroupId"
> & {
  status?: JobStatus | JobStatus[];
};

export async function getLatestPatientJob({
  cxId,
  patientId,
  jobType,
  jobGroupId,
  status,
}: ListLatestPatientJobsParams): Promise<PatientJob | undefined> {
  const statuses = getStatusFromParams(status);
  const jobs = await PatientJobModel.findAll({
    where: {
      cxId,
      patientId,
      jobType,
      jobGroupId,
      ...(statuses.length > 0 ? { status: { [Op.in]: statuses } } : {}),
    },
    order: [["createdAt", "DESC"]],
  });
  const job = jobs[0];
  if (!job) return undefined;
  return job.dataValues;
}

function getStatusFromParams(status: JobStatus | JobStatus[] | undefined): JobStatus[] {
  if (!status) return [];
  if (Array.isArray(status)) return status;
  return [status];
}

export type PatientJobPayload<T> = {
  metadata: PatientJob;
  response: T | undefined;
};

export function createPatientJobPayload<T>({
  job,
  data,
}: {
  job: PatientJob;
  data?: T;
}): PatientJobPayload<T> {
  return { metadata: job, response: data };
}
