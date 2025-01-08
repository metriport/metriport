import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { executeWithRetriesSafe, MetriportError } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { getCWData, getLinkStatusCQ } from "./patient";
import { CQLinkStatus, PatientDataCommonwell } from "./patient-shared";

dayjs.extend(duration);

const maxAttemptsToGetPatientCWData = 5;
const waitTimeBetweenAttemptsToGetPatientCWData = dayjs.duration(1, "seconds");

export type PatientWithCWData = Patient & {
  data: { externalData: { COMMONWELL: PatientDataCommonwell } };
};

const _getPatientWithCWData = async ({
  id,
  cxId,
}: Pick<Patient, "id" | "cxId">): Promise<PatientWithCWData> => {
  const patientDB = await getPatientOrFail({
    id,
    cxId,
  });

  const cwData = getCWData(patientDB.data.externalData);
  if (!cwData) throw new MetriportError(`Missing CW data on patient`);
  if (!cwData.patientId) throw new MetriportError(`Missing CW patientId`);

  const patient = patientDB.dataValues;
  return {
    ...patient,
    data: {
      ...patient.data,
      externalData: {
        ...patient.data.externalData,
        COMMONWELL: cwData,
      },
    },
  };
};

export async function getPatientWithCWData(
  patient: Patient
): Promise<PatientWithCWData | undefined> {
  return executeWithRetriesSafe(() => _getPatientWithCWData(patient), {
    maxAttempts: maxAttemptsToGetPatientCWData,
    initialDelay: waitTimeBetweenAttemptsToGetPatientCWData.asMilliseconds(),
    log: out("getPatientWithCWData").log,
  });
}

export type CWParams = {
  commonwellPatientId?: string;
  commonwellPersonId?: string;
  cqLinkStatus?: CQLinkStatus;
};

export type SetCommonwellIdParams = CWParams & {
  patient: Pick<Patient, "id" | "cxId">;
};

/**
 * Sets the CommonWell (CW) IDs and integration status on the patient.
 *
 * @param patient The patient @ Metriport.
 * @param commonwellPatientId The patient ID @ CommonWell.
 * @param commonwellPersonId The person ID @ CommonWell.
 * @param cqLinkStatus The status of linking the patient with CareQuality orgs using CW's
 *        bridge with CQ. If not provided, it will keep the current CQ link status.
 * @returns
 */
export const updateCommonwellIdsAndStatus = async ({
  patient,
  commonwellPatientId,
  commonwellPersonId,
  cqLinkStatus,
}: SetCommonwellIdParams): Promise<Patient> => {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const updatedCQLinkStatus = cqLinkStatus ?? getLinkStatusCQ(existingPatient.data.externalData);

    const externalData = existingPatient.data.externalData ?? {};

    const updateCWExternalData = {
      ...externalData,
      COMMONWELL: {
        ...externalData.COMMONWELL,
        ...(commonwellPatientId && { patientId: commonwellPatientId }),
        ...(commonwellPersonId && { personId: commonwellPersonId }),
        ...(updatedCQLinkStatus && { cqLinkStatus: updatedCQLinkStatus }),
      },
    };

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
        externalData: updateCWExternalData,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });
};
