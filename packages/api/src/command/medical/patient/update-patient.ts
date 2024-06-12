import { Patient, PatientData } from "@metriport/core/domain/patient";
import { toFHIR } from "@metriport/core/external/fhir/patient/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { patientEvents } from "../../../event/medical/patient-event";
import { upsertPatientToFHIRServer } from "../../../external/fhir/patient/upsert-patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getFacilityOrFail } from "../facility/get-facility";
import { addCoordinatesToAddresses } from "./add-coordinates";
import { getPatientOrFail } from "./get-patient";
import { sanitize, validate } from "./shared";
import { runOrSchedulePatientDiscoveryAcrossHies } from "../../../external/hie/run-or-schedule-patient-discovery";

type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientUpdateCmd = BaseUpdateCmdWithCustomer &
  PatientNoExternalData & { externalId?: string; facilityId: string };

// TODO build unit test to validate the patient is being sent correctly to Sequelize
// See: document-query.test.ts, "send a modified object to Sequelize"
// See: https://metriport.slack.com/archives/C04DMKE9DME/p1686779391180389
export async function updatePatient({
  patientUpdate,
  rerunPdOnNewDemographics,
  forceCommonwell,
  forceCarequality,
  emit = true,
}: {
  patientUpdate: PatientUpdateCmd;
  rerunPdOnNewDemographics?: boolean;
  // START TODO #1572 - remove
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  // END TODO #1572 - remove
  emit?: boolean;
}): Promise<Patient> {
  const { cxId, facilityId } = patientUpdate;

  // validate facility exists and cx has access to it
  await getFacilityOrFail({ cxId, id: facilityId });

  const patient = await updatePatientWithoutHIEs(patientUpdate, emit);

  const fhirPatient = toFHIR(patient);
  await upsertPatientToFHIRServer(patientUpdate.cxId, fhirPatient);

  runOrSchedulePatientDiscoveryAcrossHies({
    patient,
    facilityId,
    rerunPdOnNewDemographics,
    forceCommonwell,
    forceCarequality,
  }).catch(processAsyncError("runOrSchedulePatientDiscoveryAcrossHies"));

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
