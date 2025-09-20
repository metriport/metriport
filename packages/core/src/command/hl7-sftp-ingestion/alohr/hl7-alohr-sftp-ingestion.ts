import { log as createLog } from "../../../util/log";

export const HIE_NAME = "Alohr";

export const log = createLog("hl7-alohr-sftp-ingestion");

export interface Hl7AlohrSftpIngestion {
  execute(params: Hl7AlohrSftpIngestionParams): Promise<void>;
}

export interface Hl7AlohrSftpIngestionParams {
  dateTimestamp?: string;
}

export interface TimestampedMessage {
  message: string;
  timestamp: string;
  cxId: string;
  patientId: string;
}
