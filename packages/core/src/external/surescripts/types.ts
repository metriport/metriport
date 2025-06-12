import { Patient } from "@metriport/shared/domain/patient";
import { FacilityData } from "@metriport/shared/domain/customer";

export type SurescriptsGender = "M" | "F" | "N" | "U";

export interface SurescriptsRequester {
  cxId: string;
  facilityId: string;
}

export interface SurescriptsFileIdentifier {
  transmissionId: string;
  populationOrPatientId: string;
}

export interface SurescriptsRequesterData {
  cxId: string;
  facility: FacilityData;
}

export interface SurescriptsPatientRequest extends SurescriptsRequester {
  patientId: string;
}

export interface SurescriptsPatientRequestData extends SurescriptsRequesterData {
  patient: Patient;
}

export interface SurescriptsBatchRequest extends SurescriptsRequester {
  patientIds: string[];
}

export interface SurescriptsBatchRequestData extends SurescriptsRequesterData {
  patients: Patient[];
}
