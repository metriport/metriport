import { out } from "@metriport/core/util/log";
import { NotFoundError } from "@metriport/shared";
import { PatientImportMapping } from "@metriport/shared/domain/patient/patient-import/mapping";
import { PatientImportJob } from "@metriport/shared/domain/patient/patient-import/types";
import { getPatientImportJobOrFail } from "./get";
import { getSinglePatientImportMapping } from "./mapping/get";

/**
 * Gets the patient import job and mapping for a patient's data pipeline request.
 *
 * @param cxId - The customer ID.
 * @param patientId - The patient ID.
 * @param dataPipelineRequestId - The data pipeline request ID.
 * @returns the patient import job and mapping, undefined if can't find them.
 */
export async function getPatientImportByRequestId({
  cxId,
  patientId,
  dataPipelineRequestId,
}: {
  cxId: string;
  patientId: string;
  dataPipelineRequestId: string;
}): Promise<{ job: PatientImportJob; mapping: PatientImportMapping } | undefined> {
  const { log } = out(
    `getPatientImportByRequestId - cx ${cxId} patient ${patientId} dataPipelineReq ${dataPipelineRequestId}`
  );

  const mapping = await getSinglePatientImportMapping({
    cxId,
    patientId,
    dataPipelineRequestId: dataPipelineRequestId,
  });

  if (!mapping) {
    log(`No mapping found for patient`);
    return undefined;
  }

  const importJob = await getPatientImportJobOrFail({ cxId, jobId: mapping.jobId });

  return { mapping, job: importJob };
}

export async function getPatientImportByRequestIdOrFail({
  cxId,
  patientId,
  dataPipelineRequestId,
}: {
  cxId: string;
  patientId: string;
  dataPipelineRequestId: string;
}): Promise<{ job: PatientImportJob; mapping: PatientImportMapping }> {
  const result = await getPatientImportByRequestId({ cxId, patientId, dataPipelineRequestId });
  if (!result) {
    throw new NotFoundError(`Patient import not found @ PatientImport`, {
      cxId,
      patientId,
      dataPipelineRequestId,
      context: "patient-import.getPatientImportByRequestIdOrFail",
    });
  }
  return result;
}
