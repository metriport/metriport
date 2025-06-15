import { Bundle } from "@medplum/fhirtypes";
import { Patient } from "@metriport/shared/domain/patient";
import { FacilityData } from "@metriport/shared/domain/customer";
import { SftpConfig } from "../sftp/types";

export type SurescriptsGender = "M" | "F" | "N" | "U";

export enum SurescriptsEnvironment {
  Production = "P",
  Test = "T",
}
export interface SurescriptsSftpConfig extends Partial<Omit<SftpConfig, "password">> {
  senderId?: string;
  senderPassword?: string;
  receiverId?: string;
  publicKey?: string;
  privateKey?: string;
  replicaBucket?: string;
  replicaBucketRegion?: string;
}

export interface SurescriptsRequester {
  cxId: string;
  facilityId: string;
}

export interface SurescriptsFileIdentifier {
  transmissionId: string;
  populationId: string;
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

export interface SurescriptsConversionBundle {
  patientId: string;
  bundle: Bundle;
}
