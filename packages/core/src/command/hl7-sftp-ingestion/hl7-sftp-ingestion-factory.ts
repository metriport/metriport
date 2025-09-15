import { Config } from "../../util/config";
import { Hl7SubscriptionLahieIngestionCloud } from "./hl7-sftp-ingestion-cloud";
import { Hl7SubscriptionLahieIngestionDirect } from "./hl7-sftp-ingestion-direct";
import { Hl7SubscriptionLahieIngestion } from "./hl7-sftp-ingestion";
import { SftpIngestionClient } from "./sftp-ingestion-client";
import { log } from "../../util/log";

export async function buildLahieIngestion(): Promise<Hl7SubscriptionLahieIngestion> {
  if (Config.isDev()) {
    const logger = log("HL7-SFTP-INGESTION");
    const sftpClient: SftpIngestionClient = await SftpIngestionClient.create(logger, true);
    return new Hl7SubscriptionLahieIngestionDirect(sftpClient, logger);
  }
  return new Hl7SubscriptionLahieIngestionCloud();
}
