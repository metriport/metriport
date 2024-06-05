import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { executeWithRetries } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { Patient } from "@metriport/core/domain/patient";
import { DiscoveryParams } from "@metriport/core/domain/patient-discovery";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { LinkStatus } from "../patient-link";
import { getCWData, getLinkStatusCQ } from "./patient";
import { CQLinkStatus, PatientDataCommonwell } from "./patient-shared";

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

/**
 * Sets the CommonWell (CW) integration status on the patient.
 *
 * @param patient The patient @ Metriport.
 * @param status The status of integrating/synchronizing the patient @ CommonWell.
 * @param params.requestId The request ID of integrating/synchronizing the patient @ CommonWell.
 * @param params.facilityId The facility ID of integrating/synchronizing the patient @ CommonWell.
 * @param params.startedAt The start date of integrating/synchronizing the patient @ CommonWell.
 * @param params.rerunPdOnNewDemographics The flag for determining whether to re-run pattient discovery again if new demographic data is found.
 * @returns
 */
export const updatePatientDiscoveryStatus = async ({
  patient,
  status,
  params,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  status: LinkStatus;
  params?: DiscoveryParams;
}): Promise<Patient> => {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  return await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = existingPatient.data.externalData ?? {};

    if (!params && !externalData.COMMONWELL?.discoveryParams) {
      throw new MetriportError(
        `Cannot update discovery status before assining discovery params @ CW`
      );
    }

    const updatePatientDiscoveryStatus = {
      ...externalData,
      COMMONWELL: {
        ...externalData.COMMONWELL,
        status,
        ...(params && { discoveryParams: params }),
      },
    };

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
        externalData: updatePatientDiscoveryStatus,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });
};
