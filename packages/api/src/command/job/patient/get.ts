import { JobStatus, NotFoundError, PatientJob, PatientJobWithData } from "@metriport/shared";
import { Op } from "sequelize";
import { PatientJobModel } from "../../../models/patient-job";
import { GetPatientJobByIdParams } from "../shared";

export async function getPatientJobById(
  params: GetPatientJobByIdParams
): Promise<PatientJob | undefined> {
  const job = await getPatientJobModel(params);
  if (!job) return undefined;
  return job.dataValues;
}

export async function getPatientJobByIdOrFail(
  params: GetPatientJobByIdParams
): Promise<PatientJob> {
  const job = await getPatientJobModel(params);
  if (!job) throw new NotFoundError("Patient Job not found", undefined, { ...params });
  return job.dataValues;
}

export async function getPatientJobModel({
  jobId,
  cxId,
}: GetPatientJobByIdParams): Promise<PatientJobModel | undefined> {
  const job = await PatientJobModel.findOne({ where: { id: jobId, cxId } });
  if (!job) return undefined;
  return job;
}

export async function getPatientJobModelOrFail(
  params: GetPatientJobByIdParams
): Promise<PatientJobModel> {
  const job = await getPatientJobModel(params);
  if (!job) throw new NotFoundError("Patient Job not found", undefined, { ...params });
  return job;
}

export type ListPatientJobsParams = Pick<
  PatientJob,
  "cxId" | "patientId" | "jobType" | "jobGroupId"
>;

export type ListPatientJobsParamsByStatus = ListPatientJobsParams & {
  status?: JobStatus | JobStatus[];
};

export async function getLatestPatientJobByStatus({
  cxId,
  patientId,
  jobType,
  jobGroupId,
  status,
}: ListPatientJobsParamsByStatus): Promise<PatientJob | undefined> {
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

export function createJobDataPayload<T>({
  job,
  data,
}: {
  job: PatientJob;
  data?: T;
}): PatientJobWithData<T> {
  return { metadata: job, response: data };
}
