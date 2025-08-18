import {
  Patient,
  PatientCreate,
  PatientData,
  PatientDemoData,
} from "@metriport/core/domain/patient";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { PatientSettingsData } from "@metriport/core/domain/patient-settings";
import { toFHIR } from "@metriport/core/external/fhir/patient/conversion";
import { out } from "@metriport/core/util";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { upsertPatientToFHIRServer } from "../../../external/fhir/patient/upsert-patient";
import { runInitialPatientDiscoveryAcrossHies } from "../../../external/hie/run-initial-patient-discovery";
import { PatientModel } from "../../../models/medical/patient";
import { getFacilityOrFail } from "../facility/get-facility";
import { addCoordinatesToAddresses } from "./add-coordinates";
import { attachPatientIdentifiers, getPatientByDemo, PatientWithIdentifiers } from "./get-patient";
import { createPatientSettings } from "./settings/create-patient-settings";
import { sanitize, validate } from "./shared";
import { GenderAtBirth } from "@metriport/shared/domain/gender";
import { makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { Config } from "../../../shared/config";

type Identifier = Pick<Patient, "cxId" | "externalId"> & { facilityId: string };
type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientCreateCmd = PatientNoExternalData & Identifier;

async function getGender(name: string): GenderAtBirth {
  const lambdaClient = makeLambdaClient(Config.getAWSRegion());
  
  const result = await lambdaClient
    .invoke({
      FunctionName: genderizeLambdaName,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify(name),
    })
    .promise();

  return result;
}

export async function createPatient({
  patient,
  cxId,
  facilityId,
  runPd = true,
  rerunPdOnNewDemographics,
  forceCommonwell,
  forceCarequality,
  settings,
}: {
  patient: PatientCreateProps;
  runPd?: boolean;
  rerunPdOnNewDemographics?: boolean;
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  settings?: PatientSettingsData;
}): Promise<PatientWithIdentifiers> {
  const { cxId, facilityId, externalId } = patient;
  const { log } = out(`createPatient.${cxId}`);

  if (patient.genderAtBirth === "A") {
    patient.genderAtBirth = getGender(patient.firstName);
  }

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

  analytics({
    distinctId: cxId,
    event: EventTypes.patientCreate,
    properties: {
      patientId: newPatient.id,
      facilityId,
      rerunPdOnNewDemographics,
      runPd,
      forceCommonwell,
      forceCarequality,
    },
  });

  const fhirPatient = toFHIR(newPatient);

  await Promise.all([
    createPatientSettings({
      cxId,
      patientId: patientCreate.id,
      ...settings,
    }),
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
