import {
  Patient,
  PatientCreate,
  PatientData,
  PatientDemoData,
} from "@metriport/core/domain/patient";
import { toFHIR } from "@metriport/core/external/fhir/patient/conversion";
import { upsertPatientToFHIRServer } from "../../../external/fhir/patient/upsert-patient";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { PatientModel } from "../../../models/medical/patient";
import { getFacilityOrFail } from "../facility/get-facility";
import { addCoordinatesToAddresses } from "./add-coordinates";
import { getPatientByDemo } from "./get-patient";
import { sanitize, validate } from "./shared";
import { runInitialPatientDiscoveryAcrossHies } from "../../../external/hie/run-initial-patient-discovery";

type Identifier = Pick<Patient, "cxId" | "externalId"> & { facilityId: string };
type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientCreateCmd = PatientNoExternalData & Identifier;

export async function createPatient({
  patient,
  runPd = true,
  rerunPdOnNewDemographics,
  forceCommonwell,
  forceCarequality,
}: {
  patient: PatientCreateCmd;
  runPd?: boolean;
  rerunPdOnNewDemographics?: boolean;
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
}): Promise<Patient> {
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

  let newPatient = await PatientModel.create(patientCreate);

  const addressWithCoordinates = await addCoordinatesToAddresses({
    addresses: patientCreate.data.address,
    cxId: patientCreate.cxId,
    reportRelevance: true,
  });
  if (addressWithCoordinates) {
    newPatient = await newPatient.update({
      data: {
        ...newPatient.data,
        firstName,
        lastName,
        dob,
        genderAtBirth,
        personalIdentifiers,
        address: addressWithCoordinates,
        contact: contact,
      },
      externalId,
    });
  }

  const fhirPatient = toFHIR(newPatient);
  await upsertPatientToFHIRServer(newPatient.cxId, fhirPatient);

  if (runPd) {
    runInitialPatientDiscoveryAcrossHies({
      patient: newPatient.dataValues,
      facilityId,
      rerunPdOnNewDemographics,
      forceCarequality,
      forceCommonwell,
    }).catch(processAsyncError("runInitialPatientDiscoveryAcrossHies"));
  }
  return newPatient;
}
