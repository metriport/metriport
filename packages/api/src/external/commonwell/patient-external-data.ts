import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { executeWithRetries } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { cloneDeep } from "lodash";
import {
  getPatientOrFail,
  getPatientWithDependencies,
} from "../../command/medical/patient/get-patient";
import { Patient } from "../../domain/medical/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { LinkStatus } from "../patient-link";
import { getLinkStatusCQ, getLinkStatusCW } from "./patient";
import { CQLinkStatus, PatientDataCommonwell } from "./patient-shared";
import cwCommands from "./index";
import { Util } from "../..//shared/util";
import { processAsyncError } from "../../errors";

dayjs.extend(duration);

const maxAttemptsToGetPatientCWData = 4;
const waitTimeBetweenAttemptsToGetPatientCWData = dayjs.duration(3, "seconds");

export type PatientWithCWData = Patient & {
  data: { externalData: { COMMONWELL: PatientDataCommonwell } };
};

export async function getPatientWithCWDataAndRetryLinking({
  patient: { id, cxId },
  facilityId,
}: {
  patient: Patient;
  facilityId?: string;
}): Promise<PatientWithCWData | undefined> {
  const { log } = Util.out(`queryDocumentsAcrossHIEs - M patient ${id}`);
  const processLinkingStatus = async (): Promise<PatientWithCWData> => {
    const patient: Patient = await getPatientOrFail({ id, cxId });
    if (!patient.data.externalData) {
      if (!facilityId) {
        throw new Error("Facility ID is required to attempt relinking link patient");
      }
      await cwCommands.patient
        .create(patient, facilityId)
        .catch(processAsyncError(`cw.patient.create`));
    }
    const cwLinkingStatus = getLinkStatusCW(patient.data.externalData);

    switch (cwLinkingStatus) {
      case "processing":
        throw new MetriportError(`Patient ${id} is 'processing', retrying after timeout...`);
      case "failed": {
        log(`Patient ${id} is already 'failed', retrying linking...`);
        const { facilities } = await getPatientWithDependencies({ id: id, cxId });
        // should never happen, but just for type checking
        if (!facilities[0]) {
          throw new Error("No facilities found for the patient");
        }
        // this might not be the right id.
        const facilityId = facilities[0].id;

        // retry linking without waiting for it to complete
        cwCommands.patient.retryLinking(patient, facilityId);
        log(`Patient ${id} retry linking initiated, rechecking status...`);
        throw new MetriportError(`Retry linking initiated for patient ${id}, rechecking status...`); // throw error to be caught by executeWithRetries
      }
      case "completed":
        log(`Patient ${id} is linked, continuing with DQ`);
        break;

      default:
        throw new Error(`Unknown status: ${cwLinkingStatus}`);
    }
    // not ideal but ok since we verified it has cw data above
    return patient as PatientWithCWData;
  };

  return executeWithRetries(
    processLinkingStatus,
    maxAttemptsToGetPatientCWData - 1,
    waitTimeBetweenAttemptsToGetPatientCWData.asMilliseconds()
  ).catch(async () => {
    await setCommonwellLinkStatusToFailed({ patientId: id, cxId });
    throw new Error(`Retry linking failed after ${maxAttemptsToGetPatientCWData}`);
    // typescript thinks the return type is PatientWithCWData | undefined
  });
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

/**
 * Updates the commonwell status of the patient to failed
 *
 * @param patientId The patient ID @ Metriport.
 * @param cxId The customer ID @ Metriport.
 * @returns
 */
const setCommonwellLinkStatusToFailed = async ({
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

    updatedPatient.data.externalData = {
      ...updatedPatient.data.externalData,
      COMMONWELL: {
        ...updatedPatient.data.externalData?.COMMONWELL,
        status: "failed",
      },
    };

    return updatedPatient.update({ data: { ...updatedPatient.data } }, { transaction });
  });
};
