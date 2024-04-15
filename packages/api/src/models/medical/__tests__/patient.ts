import { Patient } from "@metriport/core/domain/patient";
import { makePatient } from "../../../domain/medical/__tests__/patient";
import { PatientModel } from "../patient";

export const makePatientAsPatientModel = (params?: Partial<Patient>): PatientModel =>
  makePatient(params) as PatientModel;

export const makePatientModel = (params?: Partial<PatientModel>): PatientModel => {
  const patient = makePatient(params);
  const model = new PatientModel(patient);

  model.data = patient.data;

  return model;
};
