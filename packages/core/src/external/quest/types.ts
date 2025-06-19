import { Bundle } from "@medplum/fhirtypes";
import { Patient } from "@metriport/shared/domain/patient";
import { FacilityData } from "@metriport/shared/domain/customer";
import { SftpConfig } from "../sftp/types";

export type QuestGender = "F" | "M" | "U";

export interface QuestSftpConfig extends Partial<SftpConfig> {
  local?: boolean;
  localPath?: string;
  replicaBucket?: string;
  replicaBucketRegion?: string;
}

export interface QuestRequester {
  cxId: string;
  facilityId: string;
}

export interface QuestFileIdentifier {
  transmissionId: string;
  populationId: string;
}

export type QuestJob = QuestRequester & QuestFileIdentifier;

export interface QuestRequesterData {
  cxId: string;
  facility: FacilityData;
}

export interface QuestPatientRequest extends QuestRequester {
  patientId: string;
}

export interface QuestPatientRequestData extends QuestRequesterData {
  patient: Patient;
}

export interface QuestBatchRequest extends QuestRequester {
  patientIds: string[];
}

export interface QuestBatchRequestData extends QuestRequesterData {
  patients: Patient[];
}

export interface QuestConversionBundle {
  cxId: string;
  patientId: string;
  bundle: Bundle;
}
