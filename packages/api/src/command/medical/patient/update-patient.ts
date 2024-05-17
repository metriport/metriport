import { Patient, PatientData } from "@metriport/core/domain/patient";
import { toFHIR } from "@metriport/core/external/fhir/patient/index";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { MedicalDataSource } from "@metriport/core/external/index";
import { patientEvents } from "../../../event/medical/patient-event";
import cqCommands from "../../../external/carequality";
import cwCommands from "../../../external/commonwell";
import { upsertPatientToFHIRServer } from "../../../external/fhir/patient/upsert-patient";
import { schedulePatientDiscovery } from "../../../external/hie/schedule-patient-discovery";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getFacilityOrFail } from "../facility/get-facility";
import { getCqOrgIdsToDenyOnCw } from "../../../external/hie/cross-hie-ids";
import { addCoordinatesToAddresses } from "./add-coordinates";
import { getPatientOrFail } from "./get-patient";
import { sanitize, validate } from "./shared";

type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientUpdateCmd = BaseUpdateCmdWithCustomer &
  PatientNoExternalData & { externalId?: string; facilityId: string };

// TODO build unit test to validate the patient is being sent correctly to Sequelize
// See: document-query.test.ts, "send a modified object to Sequelize"
// See: https://metriport.slack.com/archives/C04DMKE9DME/p1686779391180389
export async function updatePatient(
  patientUpdate: PatientUpdateCmd,
  emit = true,
  // START TODO #1572 - remove
  forceCommonwell?: boolean,
  forceCarequality?: boolean
  // END TODO #1572 - remove
): Promise<Patient> {
  const { cxId, facilityId } = patientUpdate;

  // validate facility exists and cx has access to it
  const facility = await getFacilityOrFail({ cxId, id: facilityId });

  const patient = await updatePatientWithoutHIEs(patientUpdate, emit);

  const fhirPatient = toFHIR(patient);
  await upsertPatientToFHIRServer(patientUpdate.cxId, fhirPatient);

  // PD Flow

  const cqData = cqCommands.patient.getCQData(patient.data.externalData);

  const discoveryStatusCq = cqData?.discoveryStatus;
  const scheduledPdRequestIdCq = cqData?.scheduledPdRequestId;

  if (discoveryStatusCq === "processing" && scheduledPdRequestIdCq) {
    // do nothing -- this update will be reflected when scheduled PD runs
  } else if (discoveryStatusCq === "processing" && !scheduledPdRequestIdCq) {
    schedulePatientDiscovery({
      requestId: uuidv7(),
      patient,
      source: MedicalDataSource.CAREQUALITY,
    });
  } else {
    await cqCommands.patient.discover(patient, facility.id, undefined, forceCarequality);
  }

  const cwData = cwCommands.patient.getCWData(patient.data.externalData);

  const statusCw = cwData?.status;
  const scheduledPdRequestIdCw = cwData?.scheduledPdRequestId;

  if (statusCw === "processing" && scheduledPdRequestIdCw) {
    // do nothing -- this update will be reflected when scheduled PD runs
  } else if (statusCw === "processing" && !scheduledPdRequestIdCw) {
    schedulePatientDiscovery({
      requestId: uuidv7(),
      patient,
      source: MedicalDataSource.COMMONWELL,
    });
  } else {
    await cwCommands.patient.update({
      patient,
      facilityId: facility.id,
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      forceCW: forceCommonwell ?? false,
    });
  }

  return patient;
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
