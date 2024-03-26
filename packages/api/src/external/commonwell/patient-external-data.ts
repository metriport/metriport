import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { executeWithRetries } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { cloneDeep } from "lodash";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { LinkStatus } from "../patient-link";
import { getCWData, getLinkStatusCQ } from "./patient";
import { CQLinkStatus, PatientDataCommonwell } from "./patient-shared";
import { queryAndProcessDocuments } from "./document/document-query";

dayjs.extend(duration);

const maxAttemptsToGetPatientCWData = 5;
const waitTimeBetweenAttemptsToGetPatientCWData = dayjs.duration(2, "seconds");

export type PatientWithCWData = Patient & {
  data: { externalData: { COMMONWELL: PatientDataCommonwell } };
};

const _getPatientWithCWData = async ({
  id,
  cxId,
}: Pick<Patient, "id" | "cxId">): Promise<PatientWithCWData | undefined> => {
  const patientDB: Patient = await getPatientOrFail({
    id,
    cxId,
  });

  const cwData = getCWData(patientDB.data.externalData);
  if (!cwData) throw new MetriportError(`Missing CW data on patient`);
  if (!cwData.patientId) throw new MetriportError(`Missing CW patientId`);

  return patientDB as PatientWithCWData;
};

export async function getPatientWithCWData(
  patient: Patient
): Promise<PatientWithCWData | undefined> {
  return executeWithRetries(
    () => _getPatientWithCWData(patient),
    maxAttemptsToGetPatientCWData - 1,
    waitTimeBetweenAttemptsToGetPatientCWData.asMilliseconds()
  );
}

/**
 * Sets the CommonWell (CW) IDs and integration status on the patient.
 *
 * @param patientId The patient ID @ Metriport.
 * @param cxId The customer ID @ Metriport.
 * @param commonwellPatientId The patient ID @ CommonWell.
 * @param commonwellPersonId The person ID @ CommonWell.
 * @param commonwellStatus The status of integrating/synchronizing the patient @ CommonWell.
 * @param cqLinkStatus The status of linking the patient with CareQuality orgs using CW's
 *        bridge with CQ. If not provided, it will keep the current CQ link status.
 * @returns
 */
export const setCommonwellId = async ({
  patientId,
  cxId,
  commonwellPatientId,
  commonwellPersonId,
  commonwellStatus,
  cqLinkStatus,
}: {
  patientId: string;
  cxId: string;
  commonwellPatientId: string;
  commonwellPersonId: string | undefined;
  commonwellStatus?: LinkStatus | undefined;
  cqLinkStatus?: CQLinkStatus | undefined;
}): Promise<Patient> => {
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const updatedPatient = await getPatientOrFail({
      id: patientId,
      cxId,
      lock: true,
      transaction,
    });

    const updatedCQLinkStatus = cqLinkStatus ?? getLinkStatusCQ(updatedPatient.data.externalData);

    const updatedData = cloneDeep(updatedPatient.data);
    updatedData.externalData = {
      ...updatedData.externalData,
      COMMONWELL: new PatientDataCommonwell(
        commonwellPatientId,
        commonwellPersonId,
        commonwellStatus,
        updatedCQLinkStatus
      ),
    };

    return updatedPatient.update({ data: updatedData }, { transaction });
  });
};

export async function updatePatientScheduledQueryRequestId({
  patient,
}: {
  patient: Patient;
}): Promise<void> {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  const scheduledDocQueryRequestId = getCWData(
    patient.data.externalData
  )?.scheduledDocQueryRequestId;

  if (!scheduledDocQueryRequestId) return;

  await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = existingPatient.data.externalData ?? {};

    const updatedExternalData = {
      ...externalData,
      COMMONWELL: {
        ...externalData.COMMONWELL,
        scheduledDocQueryRequestId: undefined,
      },
    };

    const updatedPatient = {
      ...existingPatient,
      data: {
        ...existingPatient.data,
        externalData: updatedExternalData,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    queryAndProcessDocuments({
      patient: updatedPatient,
      requestId: scheduledDocQueryRequestId,
    });
  });
}
