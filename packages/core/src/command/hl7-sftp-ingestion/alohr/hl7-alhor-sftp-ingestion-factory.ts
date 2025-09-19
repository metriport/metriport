import { Config } from "../../../util/config";
import { Hl7AlohrSftpIngestionDirect } from "./hl7-alhor-sftp-ingestion-direct";
import { Hl7AlohrSftpIngestion, log } from "./hl7-alohr-sftp-ingestion";
import { AlohrSftpIngestionClient } from "./hl7-alohr-sftp-ingestion-client";
import { Hl7AlohrSftpIngestionCloud } from "./hl7-alohr-sftp-ingestion-cloud";

export async function buildHl7AlohrSftpIngestion(
  localPassword?: string
): Promise<Hl7AlohrSftpIngestion> {
  if (Config.isDev()) {
    const sftpClient: AlohrSftpIngestionClient = await AlohrSftpIngestionClient.create(
      log,
      localPassword
    );
    return new Hl7AlohrSftpIngestionDirect(sftpClient);
  }

  return new Hl7AlohrSftpIngestionCloud();
}
