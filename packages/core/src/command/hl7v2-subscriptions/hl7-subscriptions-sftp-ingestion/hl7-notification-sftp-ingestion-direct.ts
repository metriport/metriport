import { Config } from "../../../util/config";
import { Hl7SubscriptionLaHieIngestion, LaHieSftpClient } from "./hl7-subscriptions-sftp-ingestion";

export class Hl7SubscriptionLaHieIngestionDirect implements Hl7SubscriptionLaHieIngestion {
  private sftpClient: LaHieSftpClient;
  private log: typeof console.log;

  constructor(sftpClient: LaHieSftpClient, log: typeof console.log) {
    this.sftpClient = sftpClient;
    this.log = log;
  }

  async execute(): Promise<void> {
    this.log("Beginning ingestion from LaHie");
    const remotePath = Config.getLaHieIngestionRemotePath();
    await this.sftpClient.safeSync(remotePath);
    this.log("Finished");
  }
}
