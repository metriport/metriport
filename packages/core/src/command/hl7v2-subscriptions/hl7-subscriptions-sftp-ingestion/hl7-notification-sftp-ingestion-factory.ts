import { Config } from "../../../util/config";
import { Hl7SubscriptionLaHieIngestionCloud } from "./hl7-notification-sftp-ingestion-cloud";
import { Hl7SubscriptionLaHieIngestionDirect } from "./hl7-notification-sftp-ingestion-direct";
import { Hl7SubscriptionLaHieIngestion, LaHieSftpClient } from "./hl7-subscriptions-sftp-ingestion";

export async function buildLaHieIngestion(): Promise<Hl7SubscriptionLaHieIngestion> {
  if (Config.isDev()) {
    const log = console.log;
    const sftpClient: LaHieSftpClient = await LaHieSftpClient.create(log, true);
    return new Hl7SubscriptionLaHieIngestionDirect(sftpClient, log);
  }
  return new Hl7SubscriptionLaHieIngestionCloud();
}
