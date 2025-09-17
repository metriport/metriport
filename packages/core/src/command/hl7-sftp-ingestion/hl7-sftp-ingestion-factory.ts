import { Config } from "../../util/config";
import { Hl7LahieSftpIngestionCloud } from "./hl7-sftp-ingestion-cloud";
import { LahieSftpIngestionClient } from "./sftp-ingestion-client";
import { log } from "../../util/log";
import { Hl7LahieSftpIngestionDirect } from "./hl7-sftp-ingestion-direct";
import { Hl7LahieSftpIngestion } from "./hl7-sftp-ingestion";

export async function buildLahieSftpIngestion(
  localPassword?: string
): Promise<Hl7LahieSftpIngestion> {
  if (Config.isDev()) {
    const logger = log("HL7-SFTP-INGESTION");
    const sftpClient: LahieSftpIngestionClient = await LahieSftpIngestionClient.create(
      logger,
      localPassword
    );
    return new Hl7LahieSftpIngestionDirect(sftpClient, logger);
  }
  return new Hl7LahieSftpIngestionCloud();
}
