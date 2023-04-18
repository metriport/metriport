import { Patient, PatientCreate, PatientData, PatientModel } from "../../../models/medical/patient";
import { createPatientId } from "../customer-sequence/create-id";
import { getFacilityOrFail } from "../facility/get-facility";
import { sanitize, validate } from "./shared";

type Identifier = Pick<Patient, "cxId"> & { facilityId: string };
type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientCreateCmd = PatientNoExternalData & Identifier;

export const createPatient = async (patient: PatientCreateCmd): Promise<Patient> => {
  const { cxId, facilityId } = patient;
  const sanitized = sanitize(patient);
  validate(sanitized);
  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    sanitized;

  await getFacilityOrFail({ cxId, id: facilityId });
  const { id, patientNumber } = await createPatientId(cxId);

  const patientCreate: PatientCreate = {
    id,
    patientNumber,
    cxId,
    facilityIds: [facilityId],
    data: { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact },
  };

  return PatientModel.create(patientCreate);
};
