import { Patient, PatientData } from "../../../domain/medical/patient";
import { patientEvents } from "../../../event/medical/patient-event";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientOrFail } from "./get-patient";
import { sanitize, validate } from "./shared";
import { addCoordinatesToAddresses } from "./add-coordinates";

type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientUpdateCmd = BaseUpdateCmdWithCustomer &
  PatientNoExternalData & { externalId?: string };

// TODO build unit test to validate the patient is being sent correctly to Sequelize
// See: document-query.test.ts, "send a modified object to Sequelize"
// See: https://metriport.slack.com/archives/C04DMKE9DME/p1686779391180389
export const updatePatient = async (
  patientUpdate: PatientUpdateCmd,
  emit = true
): Promise<Patient> => {
  const { id, cxId, eTag } = patientUpdate;

  const sanitized = sanitize(patientUpdate);
  validate(sanitized);

  const result = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      id,
      cxId,
      lock: true,
      transaction,
    });
    patientUpdate.address = await addCoordinatesToAddresses({
      addresses: patientUpdate.address,
      patient: patientUpdate,
      reportRelevance: true,
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
};
