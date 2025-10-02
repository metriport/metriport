import { log as createLog } from "../../util/log";

export const HIE_NAME = "Lahie";

export const log = createLog("HL7-SFTP-INGESTION");

export interface Hl7LahieSftpIngestion {
  execute(params: Hl7LahieSftpIngestionParams): Promise<void>;
}

export interface Hl7LahieSftpIngestionParams {
  dateTimestamp?: string;
}
