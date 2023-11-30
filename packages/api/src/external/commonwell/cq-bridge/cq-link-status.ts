import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { cloneDeep } from "lodash";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { Patient } from "../../../domain/medical/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getLinkStatusCQ } from "../patient";
import { CQLinkStatus } from "../patient-shared";

dayjs.extend(duration);

/**
 * Set the CQ link status on the patient.
 */
export const setCQLinkStatus = async ({
  cxId,
  patientId,
  cqLinkStatus,
}: {
  cxId: string;
  patientId: string;
  cqLinkStatus?: CQLinkStatus | undefined;
}): Promise<{ patient: Patient; updated: boolean }> => {
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const originalPatient = await getPatientOrFail({
      id: patientId,
      cxId,
      lock: true,
      transaction,
    });

    // Important so we don't trigger WH notif if the CQ link was already done
    const currentCQLinkStatus = getLinkStatusCQ(originalPatient.data.externalData);
    if (currentCQLinkStatus === cqLinkStatus) {
      console.log(
        `Patient ${patientId} already has CQ link status ${cqLinkStatus}, skipping update...`
      );
      return { patient: originalPatient, updated: false };
    }

    const updatedData = cloneDeep(originalPatient.data);
    updatedData.externalData = {
      ...updatedData.externalData,
      COMMONWELL: {
        ...updatedData.externalData?.COMMONWELL,
        cqLinkStatus,
      },
    };
    const updatedPatient = await originalPatient.update({ data: updatedData }, { transaction });

    return { patient: updatedPatient, updated: true };
  });
};
