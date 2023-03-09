import NotFoundError from "../../../errors/not-found";
import { PatientDataCommonwell } from "../../../external/commonwell/patient";
import { Patient, PatientData } from "../../../models/medical/patient";
import { getPatient } from "./get-patient";
import { sanitize, validate } from "./shared";

type PatientIdentifier = Pick<Patient, "id" | "cxId">;
type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientUpdate = PatientNoExternalData & PatientIdentifier;

export const updatePatient = async (patient: PatientUpdate): Promise<Patient> => {
  const { id, cxId } = patient;

  const sanitized = sanitize(patient);
  validate(sanitized);

  // We don't want to update other fields, nor require the caller to send
  // data that's not going to be updated, like `externalData`
  const updatedPatient = await getPatient({ id, cxId });

  const data = updatedPatient.data;
  data.firstName = sanitized.firstName;
  data.lastName = sanitized.lastName;
  data.dob = sanitized.dob;
  data.genderAtBirth = sanitized.genderAtBirth;
  data.personalIdentifiers = sanitized.personalIdentifiers;
  data.address = sanitized.address;
  data.contact = sanitized.contact;

  const [count, rows] = await Patient.update(
    {
      data,
    },
    { where: { id, cxId }, returning: true }
  );
  if (count < 1) throw new NotFoundError();
  // TODO #156 Send this to Sentry
  if (count > 1) console.error(`Updated ${count} patients for id ${id} and cxId ${cxId}`);

  return rows[0];
};

// TODO #369 move this to a CW specific command
export const setCommonwellId = async ({
  patientId,
  cxId,
  commonwellPatientId,
  commonwellPersonId,
}: {
  patientId: string;
  cxId: string;
  commonwellPatientId: string;
  commonwellPersonId: string;
}): Promise<Patient> => {
  const updatedPatient = await getPatient({ id: patientId, cxId });

  const data = updatedPatient.data;
  data.externalData = {
    ...data.externalData,
    COMMONWELL: new PatientDataCommonwell(commonwellPersonId, commonwellPatientId),
  };

  const [count, rows] = await Patient.update(
    {
      data,
    },
    { where: { id: patientId, cxId }, returning: true }
  );
  if (count < 1) throw new NotFoundError();
  // TODO #156 Send this to Sentry
  if (count > 1) console.error(`Updated ${count} patients for id ${patientId} and cxId ${cxId}`);

  return rows[0];
};
