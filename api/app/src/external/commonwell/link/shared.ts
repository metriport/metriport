import { Person } from "@metriport/commonwell-sdk";
import { apiUrl } from "../api";
import {
  Patient,
  PatientData,
  PatientExternalData,
  PatientExternalDataEntry,
} from "../../../models/medical/patient";
import { PatientDataCommonwell } from "../patient-shared";
import { MedicalDataSource } from "../..";

export const createPatientLink = (personId: string, patientId: string): string => {
  return `${apiUrl}/v1/person/${personId}/patientLink/${patientId}/`;
};

export const commonwellPersonLinks = (persons: Person[]): Person[] => {
  const links: Person[] = [];

  persons.forEach(person => {
    if (person) links.push(person);
  });

  return links;
};

export type PatientWithCW = Omit<Patient, "data"> & {
  data: Omit<PatientData, "externalData"> & {
    externalData: Omit<PatientExternalData, "COMMONWELL"> & {
      [MedicalDataSource.COMMONWELL]: PatientDataCommonwell;
    };
  };
};

export function patientWithCWData(
  patient: Patient,
  cwEntry: PatientExternalDataEntry
): PatientWithCW {
  const patientWithCW: PatientWithCW = Object.assign(patient, {
    data: {
      ...patient.data,
      externalData: {
        ...patient.data.externalData,
        [MedicalDataSource.COMMONWELL]: cwEntry as PatientDataCommonwell,
      },
    },
  });
  return patientWithCW;
}
