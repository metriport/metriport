import NotFoundError from "../../../errors/not-found";
import { Patient, PatientData } from "../../../models/medical/patient";
import { getPatient } from "./get-patient";

type PatientIdentifier = Pick<Patient, "id" | "cxId">;
type PatientNoExternalData = Omit<PatientData, "externalData">;
type PatientUpdate = PatientNoExternalData & PatientIdentifier;

export const updatePatient = async (patient: PatientUpdate): Promise<Patient> => {
  const { id, cxId } = patient;

  // We don't want to update other fields, nor require the caller to send
  // data that's not going to be updated, like `externalData`
  const updatedPatient = await getPatient({ id, cxId });

  const data = updatedPatient.data;
  data.firstName = patient.firstName;
  data.lastName = patient.lastName;
  data.dob = patient.dob;
  data.address = patient.address;
  data.contact = patient.contact;

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
