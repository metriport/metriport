import {
  Patient,
  PatientCreate,
  PatientData,
  PatientDemoData,
} from "@metriport/core/domain/patient";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import cqCommands from "../../../external/carequality";
import cwCommands from "../../../external/commonwell";
import { PatientModel } from "../../../models/medical/patient";
import { getFacilityOrFail } from "../facility/get-facility";
import { getCqOrgIdsToDenyOnCw } from "../../../external/hie/cross-hie-ids";
import { addCoordinatesToAddresses } from "./add-coordinates";
import { getPatientByDemo } from "./get-patient";
import { sanitize, validate } from "./shared";

type Identifier = Pick<Patient, "cxId" | "externalId"> & { facilityId: string };
type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientCreateCmd = PatientNoExternalData & Identifier;

export const createPatient = async (
  patient: PatientCreateCmd,
  forceCommonwell?: boolean,
  forceCarequality?: boolean
): Promise<Patient> => {
  const { cxId, facilityId, externalId } = patient;

  const sanitized = sanitize(patient);
  validate(sanitized);
  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    sanitized;
  const demo: PatientDemoData = {
    firstName,
    lastName,
    dob,
    genderAtBirth,
    personalIdentifiers,
    address,
    contact,
  };

  const patientExists = await getPatientByDemo({ cxId, demo });
  if (patientExists) return patientExists;

  // validate facility exists and cx has access to it
  await getFacilityOrFail({ cxId, id: facilityId });

  const patientCreate: PatientCreate = {
    id: uuidv7(),
    cxId,
    facilityIds: [facilityId],
    externalId,
    data: {
      firstName,
      lastName,
      dob,
      genderAtBirth,
      personalIdentifiers,
      address,
      contact,
    },
  };
  const addressWithCoordinates = await addCoordinatesToAddresses({
    addresses: patientCreate.data.address,
    cxId: patientCreate.cxId,
    reportRelevance: true,
  });
  if (addressWithCoordinates) patientCreate.data.address = addressWithCoordinates;

  const newPatient = await PatientModel.create(patientCreate);

  // PD Flow
  const requestId = uuidv7();

  await cwCommands.patient.create(
    newPatient,
    facilityId,
    getCqOrgIdsToDenyOnCw,
    requestId,
    forceCommonwell
  );

  await cqCommands.patient.discover(newPatient, facilityId, requestId, forceCarequality);

  return newPatient;
};
