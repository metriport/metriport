import { Config } from "../../util/config";
import { Hl7SubscriptionLahieIngestionCloud } from "./hl7-sftp-ingestion-cloud";
import { Hl7SubscriptionLahieIngestionDirect } from "./hl7-sftp-ingestion-direct";
import { Hl7SubscriptionLahieIngestion } from "./hl7-sftp-ingestion";
import { SftpIngestionClient } from "./sftp-ingestion-client";

export async function buildLahieIngestion(): Promise<Hl7SubscriptionLahieIngestion> {
  if (Config.isDev()) {
    const log = console.log;
    const sftpClient: SftpIngestionClient = await SftpIngestionClient.create(log, true);
    return new Hl7SubscriptionLahieIngestionDirect(sftpClient, log);
  }
  return new Hl7SubscriptionLahieIngestionCloud();
}
