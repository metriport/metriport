import { Config } from "../../util/config";
import { Hl7LahieSftpIngestionCloud } from "./hl7-sftp-ingestion-cloud";
import { LahieSftpIngestionClient } from "./sftp-ingestion-client";
import { Hl7LahieSftpIngestionDirect } from "./hl7-sftp-ingestion-direct";
import { Hl7LahieSftpIngestion, log } from "./hl7-sftp-ingestion";

export async function buildHl7LahieSftpIngestion(
  localPassword?: string
): Promise<Hl7LahieSftpIngestion> {
  if (Config.isDev()) {
    const sftpClient: LahieSftpIngestionClient = await LahieSftpIngestionClient.create(
      log,
      localPassword
    );
    return new Hl7LahieSftpIngestionDirect(sftpClient);
  }

  if (Config.isStaging()) {
    log("Staging environment is not supported");
    throw new Error("Staging environment is not supported for HL7-SFTP-INGESTION");
  }
  return new Hl7LahieSftpIngestionCloud();
}
