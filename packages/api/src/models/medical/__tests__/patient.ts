import { makePatient } from "@metriport/core/domain/__tests__/patient";
import { PatientModel } from "../patient";

/**
 * @deprecated use makePatientModelSafe, we shouldn't be creating a Sequelize Model on unit tests
 */
export function makePatientModel(params?: Partial<PatientModel>): PatientModel {
  const patient = makePatient(params);
  const model = new PatientModel(patient);

  model.data = patient.data;
  model.dataValues = patient;

  return model;
}

export function makePatientModelSafe(params?: Partial<PatientModel>): PatientModel {
  const patient = makePatient(params) as unknown as PatientModel;
  patient.dataValues = patient;
  patient.update = () => Promise.resolve(patient);
  return patient;
}
