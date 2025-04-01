import { DocumentQueryStatus, ProgressType } from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { PatientModel } from "../../../../models/medical/patient";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { getPatientModelOrFail } from "../../patient/get-patient";

export type ProgressUpdate = {
  status: DocumentQueryStatus;
};

/**
 * ADMIN ONLY, NOT TO BE CALLED BY REGULAR CODE/USERS.
 *
 * Updates the document query progress for a patient.
 * Given a progress type (convert or download) and a status, it will update the progress for the
 * patient, both on global level and on all HIE-specific levels.
 *
 * @returns The updated patient and a boolean indicating whether the patient was updated.
 */
export async function updateDocQueryProgress({
  cxId,
  patientId,
  docQueryProgress,
}: {
  cxId: string;
  patientId: string;
  docQueryProgress?: Partial<Record<ProgressType, ProgressUpdate>>;
}): Promise<{ patient: Patient; updated: boolean }> {
  const { log } = out(`updateDocQueryProgress - patient ${patientId}`);
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientModelOrFail({
      id: patientId,
      cxId,
      lock: true,
      transaction,
    });

    let updateIt = false;
    const convertStatus = docQueryProgress?.convert?.status;
    const downloadStatus = docQueryProgress?.download?.status;

    if (convertStatus) {
      if (patient.data.documentQueryProgress?.convert) {
        patient.data.documentQueryProgress.convert.status = convertStatus;
      }
      if (patient.data.externalData?.COMMONWELL?.documentQueryProgress?.convert) {
        patient.data.externalData.COMMONWELL.documentQueryProgress.convert.status = convertStatus;
      }
      if (patient.data.externalData?.CAREQUALITY?.documentQueryProgress?.convert) {
        patient.data.externalData.CAREQUALITY.documentQueryProgress.convert.status = convertStatus;
      }
      updateIt = true;
    }

    if (downloadStatus) {
      if (patient.data.documentQueryProgress?.download) {
        patient.data.documentQueryProgress.download.status = downloadStatus;
      }
      if (patient.data.externalData?.COMMONWELL?.documentQueryProgress?.download) {
        patient.data.externalData.COMMONWELL.documentQueryProgress.download.status = downloadStatus;
      }
      if (patient.data.externalData?.CAREQUALITY?.documentQueryProgress?.download) {
        patient.data.externalData.CAREQUALITY.documentQueryProgress.download.status =
          downloadStatus;
      }
      updateIt = true;
    }

    if (updateIt) {
      log(
        "Updating patient: convertStatus",
        convertStatus,
        "downloadStatus",
        downloadStatus,
        "'undefined' means no change"
      );
      patient.changed("data", true);
      const updatedPatient = await patient.save({ transaction });
      return { patient: updatedPatient.dataValues, updated: true };
    }
    return { patient: patient.dataValues, updated: false };
  });
}

/**
 * ADMIN ONLY, NOT TO BE CALLED BY REGULAR CODE/USERS.
 *
 * Gets the document query progress for a patient.
 *
 * @returns The document query progress for the patient.
 */
export async function getDocQueryProgress({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Record<"global" | "cw" | "cq", Partial<Record<ProgressType, ProgressUpdate>>>> {
  const patient = await getPatientModelOrFail({ id: patientId, cxId });

  const result = {
    global: {
      convert: patient.data.documentQueryProgress?.convert,
      download: patient.data.documentQueryProgress?.download,
    },
    cw: {
      convert: patient.data.externalData?.COMMONWELL?.documentQueryProgress?.convert,
      download: patient.data.externalData?.COMMONWELL?.documentQueryProgress?.download,
    },
    cq: {
      convert: patient.data.externalData?.CAREQUALITY?.documentQueryProgress?.convert,
      download: patient.data.externalData?.CAREQUALITY?.documentQueryProgress?.download,
    },
  };
  return result;
}
