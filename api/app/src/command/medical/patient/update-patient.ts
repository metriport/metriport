import NotFoundError from "../../../errors/not-found";
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

  const [count] = await Patient.update(
    {
      data,
    },
    { where: { id, cxId } }
  );
  if (count < 1) throw new NotFoundError();
  // TODO #156 Send this to Sentry
  if (count > 1) console.error(`Updated ${count} patients for id ${id} and cxId ${cxId}`);

  return updatedPatient;
};
