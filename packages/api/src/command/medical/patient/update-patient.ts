import { Patient, PatientData } from "@metriport/core/domain/patient";
import { toFHIR } from "@metriport/core/external/fhir/patient/index";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { MedicalDataSource } from "@metriport/core/external/index";
import { patientEvents } from "../../../event/medical/patient-event";
import cqCommands from "../../../external/carequality";
import cwCommands from "../../../external/commonwell";
import { upsertPatientToFHIRServer } from "../../../external/fhir/patient/upsert-patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getFacilityOrFail } from "../facility/get-facility";
import { getCqOrgIdsToDenyOnCw } from "../../../external/hie/cross-hie-ids";
import { addCoordinatesToAddresses } from "./add-coordinates";
import { getPatientOrFail } from "./get-patient";
import { sanitize, validate } from "./shared";
import { schedulePatientDiscovery } from "../../../external/hie/schedule-patient-discovery";

type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientUpdateCmd = BaseUpdateCmdWithCustomer &
  PatientNoExternalData & { externalId?: string; facilityId: string };

// TODO build unit test to validate the patient is being sent correctly to Sequelize
// See: document-query.test.ts, "send a modified object to Sequelize"
// See: https://metriport.slack.com/archives/C04DMKE9DME/p1686779391180389
export async function updatePatient({
  patientUpdate,
  emit = true,
  rerunPdOnNewDemographics = false,
  augmentDemographics = false,
  forceCommonwell,
  forceCarequality,
}: {
  patientUpdate: PatientUpdateCmd;
  emit?: boolean;
  rerunPdOnNewDemographics?: boolean;
  augmentDemographics?: boolean;
  // START TODO #1572 - remove
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  // END TODO #1572 - remove
}): Promise<Patient> {
  const { cxId, facilityId } = patientUpdate;

  // validate facility exists and cx has access to it
  await getFacilityOrFail({ cxId, id: facilityId });

  const patient = await updatePatientWithoutHIEs(patientUpdate, emit);

  const fhirPatient = toFHIR(patient);
  await upsertPatientToFHIRServer(patientUpdate.cxId, fhirPatient);

  const updatedPatient = await scheduleOrRunPatientDiscovery({
    patient,
    facilityId,
    rerunPdOnNewDemographics,
    augmentDemographics,
    forceCommonwell,
    forceCarequality,
  });

  return updatedPatient;
}

export async function scheduleOrRunPatientDiscovery({
  patient,
  facilityId,
  rerunPdOnNewDemographics,
  augmentDemographics,
  forceCommonwell,
  forceCarequality,
  isRerunFromNewDemographics = false,
  overrideSchedule = false,
}: {
  patient: Patient;
  facilityId: string;
  rerunPdOnNewDemographics: boolean;
  augmentDemographics: boolean;
  // START TODO #1572 - remove
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  // END TODO #1572 - remove
  overrideSchedule?: boolean;
  isRerunFromNewDemographics?: boolean;
}): Promise<Patient> {
  let updatedPatient = patient;
  const cqData = cqCommands.patient.getCQData(patient.data.externalData);

  const discoveryStatusCq = cqData?.discoveryStatus;
  const scheduledPdRequestCq = cqData?.scheduledPdRequest;

  if (
    discoveryStatusCq === "processing" &&
    (!scheduledPdRequestCq || (scheduledPdRequestCq && overrideSchedule))
  ) {
    updatedPatient = await schedulePatientDiscovery({
      requestId: uuidv7(),
      patient,
      source: MedicalDataSource.CAREQUALITY,
      facilityId,
      rerunPdOnNewDemographics,
      augmentDemographics,
      isRerunFromNewDemographics,
    });
  } else if (discoveryStatusCq === "processing" && scheduledPdRequestCq) {
    // Do nothing
  } else {
    await cqCommands.patient.discover({
      patient,
      facilityId,
      forceEnabled: forceCarequality,
      rerunPdOnNewDemographics,
      augmentDemographics,
    });
  }

  const cwData = cwCommands.patient.getCWData(patient.data.externalData);

  const statusCw = cwData?.status;
  const scheduledPdRequestCw = cwData?.scheduledPdRequest;

  if (
    statusCw === "processing" &&
    (!scheduledPdRequestCw || (scheduledPdRequestCw && overrideSchedule))
  ) {
    updatedPatient = await schedulePatientDiscovery({
      requestId: uuidv7(),
      patient,
      source: MedicalDataSource.COMMONWELL,
      facilityId,
      rerunPdOnNewDemographics,
      augmentDemographics,
      isRerunFromNewDemographics,
    });
  } else if (statusCw === "processing" && scheduledPdRequestCw) {
    // Do nothing
  } else {
    await cwCommands.patient.update({
      patient,
      facilityId,
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      forceCWUpdate: forceCommonwell,
      rerunPdOnNewDemographics,
      augmentDemographics,
    });
  }

  return updatedPatient;
}

export async function updatePatientWithoutHIEs(
  patientUpdate: PatientUpdateCmd,
  emit = true
): Promise<Patient> {
  const { id, cxId, eTag } = patientUpdate;

  const sanitized = sanitize(patientUpdate);
  validate(sanitized);

  const addressWithCoordinates = await addCoordinatesToAddresses({
    addresses: patientUpdate.address,
    cxId: patientUpdate.cxId,
    reportRelevance: true,
  });
  if (addressWithCoordinates) patientUpdate.address = addressWithCoordinates;

  const result = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      id,
      cxId,
      lock: true,
      transaction,
    });

    validateVersionForUpdate(patient, eTag);

    return patient.update(
      {
        data: {
          ...patient.data,
          firstName: sanitized.firstName,
          lastName: sanitized.lastName,
          dob: sanitized.dob,
          genderAtBirth: sanitized.genderAtBirth,
          personalIdentifiers: sanitized.personalIdentifiers,
          address: patientUpdate.address,
          contact: sanitized.contact,
        },
        externalId: sanitized.externalId,
      },
      { transaction }
    );
  });

  if (emit) patientEvents().emitUpdated(result);

  return result;
}
