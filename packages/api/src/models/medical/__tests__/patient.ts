import { Patient } from "../../../domain/medical/patient";
import { makePatient } from "../../../domain/medical/__tests__/patient";
import { PatientModel } from "../patient";

export const makePatientModel = (params?: Partial<Patient>): PatientModel =>
  makePatient(params) as PatientModel;
