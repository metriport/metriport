import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { executeWithRetries } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { cloneDeep } from "lodash";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { Patient } from "../../domain/medical/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { LinkStatus } from "../patient-link";
import { getLinkStatusCQ, getLinkStatusCW } from "./patient";
import { CQLinkStatus, PatientDataCommonwell } from "./patient-shared";

dayjs.extend(duration);

const maxAttemptsToGetPatientCWData = 3;
const waitTimeBetweenAttemptsToGetPatientCWData = dayjs.duration(2, "seconds");

export type PatientWithCWData = Patient & {
  data: { externalData: { COMMONWELL: PatientDataCommonwell } };
};

export async function getPatientWithCWData(patient: Patient): Promise<PatientWithCWData> {
  const getPatientWithCWDataOrFail = async () => {
    const patientDB: Patient = await getPatientOrFail({
      id: patient.id,
      cxId: patient.cxId,
    });
    if (getLinkStatusCW(patientDB.data.externalData) !== "completed") {
      throw new MetriportError(`Patient is not linked to CW`);
    }
    return patientDB as PatientWithCWData;
  };

  return executeWithRetries(
    getPatientWithCWDataOrFail,
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
