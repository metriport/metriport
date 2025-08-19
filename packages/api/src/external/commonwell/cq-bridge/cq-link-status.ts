import { Patient } from "@metriport/core/domain/patient";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { cloneDeep } from "lodash";
import { getPatientModelOrFail } from "../../../command/medical/patient/get-patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getLinkStatusCQ } from "../patient";
import { CQLinkStatus } from "../patient-shared";
import { PatientDataCommonwell } from "../patient-shared";

dayjs.extend(duration);
const PARALLEL_UPDATES = 10;

export async function setCQLinkStatuses({
  cxId,
  patientIds,
  cqLinkStatus,
}: {
  cxId: string;
  patientIds: string[];
  cqLinkStatus: CQLinkStatus;
}): Promise<void> {
  const setCQLinkStatusBulk = async (patientId: string): Promise<void> => {
    const { updated } = await setCQLinkStatus({ cxId, patientId, cqLinkStatus });
    if (!updated) return;
  };

  await executeAsynchronously(patientIds, setCQLinkStatusBulk, {
    numberOfParallelExecutions: PARALLEL_UPDATES,
  });
}

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
  const { log } = out(`setCQLinkStatus - patient ${patientId}`);
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientModelOrFail({
      id: patientId,
      cxId,
      lock: true,
      transaction,
    });

    // Important so we don't trigger WH notif if the CQ link was already done
    const currentCQLinkStatus = getLinkStatusCQ(patient.dataValues.data.externalData);
    if (currentCQLinkStatus === cqLinkStatus) {
      log(`Patient already has CQ link status ${cqLinkStatus}, skipping update...`);
      return { patient: patient.dataValues, updated: false };
    }

    const updatedData = cloneDeep(patient.dataValues.data);
    const cwData = {
      ...updatedData.externalData?.COMMONWELL,
      cqLinkStatus,
    } as PatientDataCommonwell;

    updatedData.externalData = {
      ...updatedData.externalData,
      COMMONWELL: cwData,
    };

    const updatedPatient = await patient.update({ data: updatedData }, { transaction });

    return { patient: updatedPatient.dataValues, updated: true };
  });
};
