import { cloneDeep } from "lodash";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { Patient } from "../../domain/medical/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { LinkStatus } from "../patient-link";
import { getCQLinkStatus } from "./patient";
import { CQLinkStatus, PatientDataCommonwell } from "./patient-shared";

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

    const updatedCQLinkStatus = cqLinkStatus ?? getCQLinkStatus(updatedPatient.data.externalData);

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

/**
 * Updates the commonwell status of the patient to failed
 *
 * @param patientId The patient ID @ Metriport.
 * @param cxId The customer ID @ Metriport.
 * @returns
 */
export const setCommonwellLinkStatusToFailed = async ({
  patientId,
  cxId,
}: {
  patientId: string;
  cxId: string;
}): Promise<Patient> => {
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const updatedPatient = await getPatientOrFail({
      id: patientId,
      cxId,
      lock: true,
      transaction,
    });

    const updatedData = cloneDeep(updatedPatient.data);
    updatedPatient.data.externalData = {
      ...updatedPatient.data.externalData,
      COMMONWELL: {
        ...(updatedPatient.data.externalData?.COMMONWELL as PatientDataCommonwell),
        status: "failed",
      },
    };

    return updatedPatient.update({ data: updatedData }, { transaction });
  });
};
