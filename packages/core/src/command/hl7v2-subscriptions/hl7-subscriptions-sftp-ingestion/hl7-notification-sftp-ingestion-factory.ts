import { Config } from "../../../util/config";
import { Hl7SubscriptionLaHieIngestionCloud } from "./hl7-notification-sftp-ingestion-cloud";
import { Hl7SubscriptionLaHieIngestionDirect } from "./hl7-notification-sftp-ingestion-direct";
import { Hl7SubscriptionLaHieIngestion, LaHieSftpClient } from "./hl7-subscriptions-sftp-ingestion";

export async function buildLaHieIngestionDirect(): Promise<Hl7SubscriptionLaHieIngestion> {
  if (Config.isDev()) {
    const sftpClient: LaHieSftpClient = await LaHieSftpClient.create(true);
    const log = console.log;
    return new Hl7SubscriptionLaHieIngestionDirect(sftpClient, log);
  }
  return new Hl7SubscriptionLaHieIngestionCloud();
}
