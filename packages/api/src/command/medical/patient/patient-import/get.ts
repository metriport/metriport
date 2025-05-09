import { NotFoundError } from "@metriport/shared";
import { PatientImportJobStatus } from "@metriport/shared/domain/patient/patient-import/status";
import { PatientImportJob } from "@metriport/shared/domain/patient/patient-import/types";
import { Op } from "sequelize";
import { PatientImportJobModel } from "../../../../models/medical/patient-import";

type GetPatientImportJobParams = {
  cxId: string;
  jobId: string;
};

/**
 * Gets a bulk patient import job.
 *
 * @param cxId - The customer ID.
 * @param id - The bulk import job ID.
 * @returns the bulk import job.
 */
export async function getPatientImportJob({
  cxId,
  jobId,
}: GetPatientImportJobParams): Promise<PatientImportJob | undefined> {
  const job = await getPatientImportJobModel({ cxId, jobId });
  return job?.dataValues;
}

/**
 * Gets a bulk patient import job or fails if it doesn't exist.
 *
 * @param cxId - The customer ID.
 * @param id - The bulk import job ID.
 * @returns the bulk import job.
 * @throws NotFoundError if the job doesn't exist.
 */
export async function getPatientImportJobOrFail({
  cxId,
  jobId,
}: GetPatientImportJobParams): Promise<PatientImportJob> {
  const job = await getPatientImportJobModelOrFail({ cxId, jobId });
  return job.dataValues;
}

/**
 * Gets a bulk patient import job model.
 *
 * @param cxId - The customer ID.
 * @param id - The bulk import job ID.
 * @returns the bulk import job model.
 */
export async function getPatientImportJobModel({
  cxId,
  jobId,
}: GetPatientImportJobParams): Promise<PatientImportJobModel | null> {
  return PatientImportJobModel.findOne({ where: { cxId, id: jobId } });
}

/**
 * Gets a bulk patient import job model or fails if it doesn't exist.
 *
 * @param cxId - The customer ID.
 * @param id - The bulk import job ID.
 * @returns the bulk import job model.
 * @throws NotFoundError if the job doesn't exist.
 */
export async function getPatientImportJobModelOrFail({
  cxId,
  jobId,
}: GetPatientImportJobParams): Promise<PatientImportJobModel> {
  const job = await getPatientImportJobModel({ cxId, jobId });
  if (!job) {
    throw new NotFoundError(`Patient import job not found`);
  }
  return job;
}

export async function getPatientImportJobList({
  cxId,
  jobIds,
  status: statusParam,
}: {
  cxId: string;
  jobIds?: string[];
  status?: PatientImportJobStatus | PatientImportJobStatus[];
}): Promise<PatientImportJob[]> {
  const status = statusParam
    ? Array.isArray(statusParam)
      ? statusParam
      : [statusParam]
    : undefined;
  const jobs = await PatientImportJobModel.findAll({
    where: {
      cxId,
      ...(jobIds ? { id: { [Op.in]: jobIds } } : {}),
      ...(status ? { status: { [Op.in]: status } } : {}),
    },
  });
  return jobs.map(j => j.dataValues);
}
