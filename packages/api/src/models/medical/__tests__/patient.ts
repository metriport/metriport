import { Patient } from "@metriport/core/domain/patient";
import { makePatient } from "../../../domain/medical/__tests__/patient";
import { PatientModel } from "../patient";

export const makePatientModel = (params?: Partial<Patient>): PatientModel =>
  makePatient(params) as PatientModel;
