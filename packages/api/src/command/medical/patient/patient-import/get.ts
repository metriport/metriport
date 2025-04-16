import { NotFoundError } from "@metriport/shared";
import { PatientImportStatus } from "@metriport/shared/domain/patient/patient-import/status";
import { PatientImport } from "@metriport/shared/domain/patient/patient-import/types";
import { Op } from "sequelize";
import { PatientImportModel } from "../../../../models/medical/patient-import";

type GetPatientImportJobParams = {
  cxId: string;
  id: string;
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
  id,
}: GetPatientImportJobParams): Promise<PatientImport | undefined> {
  const job = await getPatientImportJobModel({ cxId, id });
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
  id,
}: GetPatientImportJobParams): Promise<PatientImport> {
  const job = await getPatientImportJobModelOrFail({ cxId, id });
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
  id,
}: GetPatientImportJobParams): Promise<PatientImportModel | null> {
  return PatientImportModel.findOne({ where: { cxId, id } });
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
  id,
}: GetPatientImportJobParams): Promise<PatientImportModel> {
  const job = await getPatientImportJobModel({ cxId, id });
  if (!job) {
    throw new NotFoundError(`Patient import job not found`);
  }
  return job;
}

export async function getPatientImportJobList({
  cxId,
  ids,
  status: statusParam,
}: {
  cxId: string;
  ids?: string[];
  status?: PatientImportStatus | PatientImportStatus[];
}): Promise<PatientImport[]> {
  const status = statusParam
    ? Array.isArray(statusParam)
      ? statusParam
      : [statusParam]
    : undefined;
  const jobs = await PatientImportModel.findAll({
    where: {
      cxId,
      ...(ids ? { id: { [Op.in]: ids } } : {}),
      ...(status ? { status: { [Op.in]: status } } : {}),
    },
  });
  return jobs.map(j => j.dataValues);
}
