import { OrganizationData } from "@metriport/shared/domain/customer";
import { Patient } from "@metriport/shared/domain/patient";
import { SftpConfig, SftpFile } from "../sftp/types";

export type SurescriptsGender = "M" | "F" | "U";

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

export interface SurescriptsRequesterData {
  cxId: string;
  org: OrganizationData;
  facilityNpiMap: Record<string, string>;
}

export interface SurescriptsBatchRequestData extends SurescriptsRequesterData {
  populationId: string;
  patients: Patient[];
  includeMultipleDemographics: boolean;
}

export interface SurescriptsFileIdentifier {
  transmissionId: string;
  populationId: string;
}

export type SurescriptsSftpFile = SftpFile & SurescriptsFileIdentifier;
