export const HIE_NAME = "Lahie";

export interface Hl7LahieSftpIngestion {
  execute(params: Hl7LahieSftpIngestionParams): Promise<void>;
}

export interface Hl7LahieSftpIngestionParams {
  dateTimestamp?: string;
}
