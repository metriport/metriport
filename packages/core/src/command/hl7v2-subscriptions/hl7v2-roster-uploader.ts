import { out } from "../../util";
import { HieConfig, VpnlessHieConfig } from "./types";
import { SftpClient } from "../../external/sftp/client";
import { HieSftpConfig } from "../../external/sftp/types";
import { createFileNameHl7v2Roster } from "./hl7v2-roster-generator";
import { simpleExecuteWithRetries } from "@metriport/shared";
import { initTimer } from "@metriport/shared/common/timer";
import { Config } from "../../util/config";
import { getSecretValueOrFail } from "../../external/aws/secret-manager";

export async function uploadToRemoteSftp(
  config: HieConfig | VpnlessHieConfig,
  file: string
): Promise<void> {
  const { log } = out("Hl7v2RosterUploader");
  log(`Starting SFTP upload for config: ${config.name}`);
  const uploadTimer = initTimer();

  const sftpConfig = config.sftpConfig;

  const loggingDetails = {
    hieName: config.name,
    host: sftpConfig.host,
    port: sftpConfig.port,
    username: sftpConfig.username,
    remotePath: sftpConfig.remotePath,
  };
  log(`Running with this config: ${JSON.stringify(loggingDetails)}`);

  const hieName = config.name;

  const remoteFileName = createFileNameHl7v2Roster(hieName);

  await simpleExecuteWithRetries(() => sendViaSftp(sftpConfig, file, remoteFileName), log);
  log(`SFTP upload completed in ${uploadTimer.getElapsedTime()}ms`);
}

async function sendViaSftp(sftpConfig: HieSftpConfig, file: string, remoteFileName: string) {
  const remoteFolderPath = sftpConfig.remotePath;
  const region = Config.getAWSRegion();

  const passwordName = Config.getRosterUploadSftpPasswordName();
  const password = await getSecretValueOrFail(passwordName, region);

  const client = new SftpClient({
    ...sftpConfig,
    password,
  });

  try {
    await client.connect();
    const folderExists = await client.exists(remoteFolderPath);
    if (!folderExists) {
      throw new Error("Folder does not exist.");
    }

    const fullPath = getFullPath(remoteFolderPath, remoteFileName);

    await client.write(fullPath, Buffer.from(file, "utf-8"));
  } finally {
    await client.disconnect();
  }
}

function getFullPath(folderPath: string, filePath: string): string {
  const cleanFolder = folderPath.replace(/\/+$/, "");
  const cleanFile = filePath.replace(/^\/+/, "");
  return `${cleanFolder}/${cleanFile}`;
}
