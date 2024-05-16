import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { executeWithRetries } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { Patient } from "@metriport/core/domain/patient";
import { LinkStatus } from "../patient-link";
import { getCWData } from "./patient";
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
  commonwellPatientId: string;
  commonwellPersonId: string | undefined;
  commonwellStatus: LinkStatus | undefined;
  cqLinkStatus: CQLinkStatus | undefined;
};
