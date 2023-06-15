import { Progress } from "../../../domain/medical/document-reference";
import { Patient, PatientModel } from "../../../models/medical/patient";
import { getPatientOrFail } from "./get-patient";

export type SetDocQueryProgress = {
  patient: Pick<Patient, "id" | "cxId">;
} & (
  | {
      downloadProgress?: Progress | undefined | null;
      convertProgress?: Progress | undefined | null;
      reset?: false | undefined;
    }
  | {
      downloadProgress: Progress;
      convertProgress?: never;
      reset?: true;
    }
);

/**
 * Appends the given properties of a patient's document query progress.
 * Keeps existing sibling properties when those are not provided, unless
 * 'reset=true' is provided.
 * @returns
 */
export async function appendDocQueryProgress({
  patient,
  downloadProgress,
  convertProgress,
  reset,
}: SetDocQueryProgress): Promise<Patient> {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };
  const existingPatient = await getPatientOrFail(patientFilter);

  const documentQueryProgress =
    reset || !existingPatient.data.documentQueryProgress
      ? {}
      : existingPatient.data.documentQueryProgress;

  if (downloadProgress) {
    documentQueryProgress.download = {
      ...documentQueryProgress.download,
      ...downloadProgress,
    };
  } else if (downloadProgress === null) {
    documentQueryProgress.download = undefined;
  }

  if (convertProgress) {
    documentQueryProgress.convert = {
      ...documentQueryProgress.convert,
      ...convertProgress,
    };
  } else if (convertProgress === null) {
    documentQueryProgress.convert = undefined;
  }

  const updatedPatient = {
    ...existingPatient,
    data: {
      ...existingPatient.data,
      documentQueryProgress,
    },
  };
  await PatientModel.update(updatedPatient, { where: patientFilter });
  return updatedPatient;
}
