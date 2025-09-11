import { Config } from "../../../util/config";
import { Hl7SubscriptionLaHieIngestionCloud } from "./hl7-subscriptions-sftp-ingestion-cloud";
import { Hl7SubscriptionLaHieIngestionDirect } from "./hl7-subscriptions-sftp-ingestion-direct";
import { Hl7SubscriptionLaHieIngestion } from "./hl7-subscriptions-sftp-ingestion";
import { SftpIngestionClient } from "./sftp-ingestion-client";

export async function buildLaHieIngestion(): Promise<Hl7SubscriptionLaHieIngestion> {
  if (Config.isDev()) {
    const log = console.log;
    const sftpClient: SftpIngestionClient = await SftpIngestionClient.create(log, true);
    return new Hl7SubscriptionLaHieIngestionDirect(sftpClient, log);
  }
  return new Hl7SubscriptionLaHieIngestionCloud();
}
