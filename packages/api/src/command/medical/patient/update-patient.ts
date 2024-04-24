import { Patient, PatientData } from "@metriport/core/domain/patient";
import { toFHIR } from "@metriport/core/external/fhir/patient/index";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { patientEvents } from "../../../event/medical/patient-event";
import cqCommands from "../../../external/carequality";
import cwCommands from "../../../external/commonwell";
import { upsertPatientToFHIRServer } from "../../../external/fhir/patient/upsert-patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getFacilityOrFail } from "../facility/get-facility";
import { getCqOrgIdsToDenyOnCw } from "../hie/cross-hie-ids";
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

  const requestId = uuidv7();

  const patientUpdateWithPD: PatientUpdateCmd = {
    ...patientUpdate,
    patientDiscovery: { requestId, startedAt: new Date() },
  };

  const patient = await updatePatientWithoutHIEs(patientUpdateWithPD, emit);

  const fhirPatient = toFHIR(patient);
  await upsertPatientToFHIRServer(patientUpdate.cxId, fhirPatient);

  await cqCommands.patient.discover(patient, facility.data.npi, requestId, forceCarequality);

  await cwCommands.patient.update(
    patient,
    facilityId,
    getCqOrgIdsToDenyOnCw,
    requestId,
    forceCommonwell
  );

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
    patient: patientUpdate,
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
