import { Patient, PatientCreate, PatientData } from "@metriport/core/domain/patient";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { processAsyncError } from "../../../errors";
import {
  isCarequalityStandbyModeEnabled,
  isCommonwellStandbyModeEnabled,
} from "../../../external/aws/appConfig";
import cqCommands from "../../../external/carequality";
import cwCommands from "../../../external/commonwell";
import { PatientModel } from "../../../models/medical/patient";
import { Config } from "../../../shared/config";
import { getFacilityOrFail } from "../facility/get-facility";
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

  const patientExists = await getPatientByDemo({
    cxId,
    demo: { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact },
  });
  if (patientExists) return patientExists;

  // validate facility exists and cx has access to it
  const facility = await getFacilityOrFail({ cxId, id: facilityId });

  const patientCreate: PatientCreate = {
    id: uuidv7(),
    cxId,
    facilityIds: [facilityId],
    externalId,
    data: { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact },
  };
  const addressWithCoordinates = await addCoordinatesToAddresses({
    addresses: patientCreate.data.address,
    patient: patientCreate,
    reportRelevance: true,
  });
  if (addressWithCoordinates) patientCreate.data.address = addressWithCoordinates;

  const newPatient = await PatientModel.create(patientCreate);

  const commonwellStandbyModeEnabled = await isCommonwellStandbyModeEnabled();
  if (!commonwellStandbyModeEnabled || forceCommonwell || Config.isSandbox()) {
    cwCommands.patient.create(newPatient, facilityId).catch(processAsyncError(`cw.patient.create`));
  }

  // Intentionally asynchronous
  const carequalityStandbyModeEnabled = await isCarequalityStandbyModeEnabled();
  if (!carequalityStandbyModeEnabled || forceCarequality) {
    cqCommands.patient
      .discover(newPatient, facility.data.npi)
      .catch(processAsyncError(`cq.patient.create`));
  }

  return newPatient;
};
