import {
  Patient,
  PatientCreate,
  PatientData,
  PatientDemoData,
} from "@metriport/core/domain/patient";
import { toFHIR } from "@metriport/core/external/fhir/patient/conversion";
import { out } from "@metriport/core/util";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { upsertPatientToFHIRServer } from "../../../external/fhir/patient/upsert-patient";
import { runInitialPatientDiscoveryAcrossHies } from "../../../external/hie/run-initial-patient-discovery";
import { PatientModel } from "../../../models/medical/patient";
import { getFacilityOrFail } from "../facility/get-facility";
import { addCoordinatesToAddresses } from "./add-coordinates";
import { createPatientSettings } from "./create-patient-settings";
import { PatientWithIdentifiers, attachPatientIdentifiers, getPatientByDemo } from "./get-patient";
import { sanitize, validate } from "./shared";

type Identifier = Pick<Patient, "cxId" | "externalId"> & { facilityId: string };
type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientCreateCmd = PatientNoExternalData & Identifier;

export async function createPatient({
  patient,
  runPd = true,
  rerunPdOnNewDemographics,
  forceCommonwell,
  forceCarequality,
  adtSubscription = false,
}: {
  patient: PatientCreateCmd;
  runPd?: boolean;
  rerunPdOnNewDemographics?: boolean;
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  adtSubscription?: boolean;
}): Promise<PatientWithIdentifiers> {
  const { cxId, facilityId, externalId } = patient;
  const { log } = out(`createPatient.${cxId}`);

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
    log,
  });
  if (addressWithCoordinates) patientCreate.data.address = addressWithCoordinates;

  const newPatient = await PatientModel.create(patientCreate);
  const fhirPatient = toFHIR(newPatient);

  await Promise.all([
    createPatientSettings({ cxId, patientId: patientCreate.id, adtSubscription }),
    upsertPatientToFHIRServer(newPatient.cxId, fhirPatient),
  ]);

  if (runPd) {
    runInitialPatientDiscoveryAcrossHies({
      patient: newPatient.dataValues,
      facilityId,
      rerunPdOnNewDemographics,
      forceCarequality,
      forceCommonwell,
    }).catch(processAsyncError("runInitialPatientDiscoveryAcrossHies"));
  }
  const patientWithIdentifiers = await attachPatientIdentifiers(newPatient.dataValues);
  return patientWithIdentifiers;
}
