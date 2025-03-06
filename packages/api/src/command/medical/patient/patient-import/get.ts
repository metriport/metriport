import { NotFoundError } from "@metriport/shared";
import { PatientImport } from "@metriport/shared/domain/patient/patient-import/types";
import { PatientImportModel } from "../../../../models/medical/patient-import";

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
}: {
  cxId: string;
  id: string;
}): Promise<PatientImport | undefined> {
  const job = await PatientImportModel.findOne({ where: { cxId, id } });
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
}: {
  cxId: string;
  id: string;
}): Promise<PatientImport> {
  const job = await getPatientImportJob({ cxId, id });
  if (!job) {
    throw new NotFoundError(`Patient import job not found`);
  }
  return job;
}
