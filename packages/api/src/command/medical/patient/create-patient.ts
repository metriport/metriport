import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { Patient, PatientCreate, PatientData } from "../../../domain/medical/patient";
import { processAsyncError } from "../../../errors";
import cwCommands from "../../../external/commonwell";
import cqCommands from "../../../external/carequality";
import { PatientModel } from "../../../models/medical/patient";
import { getFacilityOrFail } from "../facility/get-facility";
import { getOrganizationOrFail } from "../organization/get-organization";
import { getPatientByDemo } from "./get-patient";
import { sanitize, validate } from "./shared";

type Identifier = Pick<Patient, "cxId" | "externalId"> & { facilityId: string };
type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientCreateCmd = PatientNoExternalData & Identifier;

export const createPatient = async (patient: PatientCreateCmd): Promise<Patient> => {
  const { cxId, facilityId, externalId } = patient;

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

  // validate facility exists and cx has access to it
  await getFacilityOrFail({ cxId, id: facilityId });

  const patientCreate: PatientCreate = {
    id: uuidv7(),
    cxId,
    facilityIds: [facilityId],
    externalId,
    data: { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact },
  };
  const newPatient = await PatientModel.create(patientCreate);

  // TODO: #393 declarative, event-based integration
  // Intentionally asynchronous - it takes too long to perform
  cwCommands.patient.create(newPatient, facilityId).catch(processAsyncError(`cw.patient.create`));

  const organization = await getOrganizationOrFail({ cxId, id: facilityId });

  cqCommands.patient
    .discover(newPatient, organization, facilityId)
    .catch(processAsyncError(`cq.patient.create`));

  return newPatient;
};
