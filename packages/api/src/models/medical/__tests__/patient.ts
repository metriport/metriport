import { makePatient } from "@metriport/core/domain/__tests__/patient";
import { PatientModel } from "../patient";

export function makePatientModel(params?: Partial<PatientModel>): PatientModel {
  const patient = makePatient(params) as unknown as PatientModel;
  patient.dataValues = patient;
  patient.save = jest.fn();
  patient.update = jest.fn();
  patient.destroy = jest.fn();
  return patient;
}
