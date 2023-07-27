import { Patient, PatientCreate, PatientData, PatientModel } from "../../../models/medical/patient";
import { createPatientId } from "../customer-sequence/create-id";
import { getFacilityOrFail } from "../facility/get-facility";
import { sanitize, validate } from "./shared";
import cwCommands from "../../../external/commonwell";
import { processAsyncError } from "../../../errors";
import { getPatientByDemo } from "./get-patient";

type Identifier = Pick<Patient, "cxId"> & { facilityId: string };
type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientCreateCmd = PatientNoExternalData & Identifier;

export const createPatient = async (patient: PatientCreateCmd): Promise<Patient> => {
  const { cxId, facilityId } = patient;

  const sanitized = sanitize(patient);
  validate(sanitized);
  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    sanitized;

  const patientExists = await getPatientByDemo({
    facilityId,
    cxId,
    demo: { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact },
  });

  if (patientExists) return patientExists;

  await getFacilityOrFail({ cxId, id: facilityId });
  const { id, patientNumber } = await createPatientId(cxId);

  const patientCreate: PatientCreate = {
    id,
    patientNumber,
    cxId,
    facilityIds: [facilityId],
    data: { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact },
  };

  const newPatient = await PatientModel.create(patientCreate);

  // TODO: #393 declarative, event-based integration
  // Intentionally asynchronous - it takes too long to perform
  cwCommands.patient.create(newPatient, facilityId).catch(processAsyncError(`cw.patient.create`));

  return newPatient;
};
