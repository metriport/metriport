import { makePatient } from "@metriport/core/domain/__tests__/patient";
import { PatientModel } from "../patient";

export function makePatientModel(params?: Partial<PatientModel>): PatientModel {
  const patient = makePatient(params);
  const model = new PatientModel(patient);

  model.data = patient.data;
  model.dataValues = patient;

  return model;
}
