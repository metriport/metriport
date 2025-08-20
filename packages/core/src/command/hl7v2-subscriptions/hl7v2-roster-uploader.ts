import { out } from "../../util";
import { HieConfig, VpnlessHieConfig } from "./types";
import { SftpClient } from "../../external/sftp/client";
import { executeWithRetries } from "@metriport/shared/common/retry";
import { SftpConfig } from "../../external/sftp/types";
import { createFileNameHl7v2Roster } from "./hl7v2-roster-generator";
import { getSecretValueOrFail } from "../../external/aws/secret-manager";
import { MetriportError } from "@metriport/shared";
import { Config } from "../../util/config";
import { initTimer } from "@metriport/shared/common/timer";

const NUMBER_OF_ATTEMPTS = 3;
const BASE_DELAY = 1000;

export async function uploadThroughSftp(
  config: HieConfig | VpnlessHieConfig,
  file: string
): Promise<void> {
  const { log } = out("[STUB] - Hl7v2RosterUploader");
  log(`Starting SFTP upload for config: ${config.name}`);
  const uploadTimer = initTimer();

  const loggingDetails = {
    hieName: config.name,
    host: config.sftpConfig?.host,
    port: config.sftpConfig?.port,
    username: config.sftpConfig?.username,
    remotePath: config.remotePath,
  };
  log(`Running with this config: ${JSON.stringify(loggingDetails)}`);

  const hieName = config.name;

  const remoteFileName = createFileNameHl7v2Roster(hieName);
  const sftpConfig = config.sftpConfig;
  const remotePath = config.remotePath;
  if (!sftpConfig) {
    throw new MetriportError("Sftp config is required!", undefined, { sftpConfig });
  }

  if (!remotePath) {
    throw new MetriportError("Sftp remotePath is required!", undefined, { remotePath });
  }

  await executeWithRetries(() => sendViaSftp(sftpConfig, file, remotePath, remoteFileName), {
    maxAttempts: NUMBER_OF_ATTEMPTS,
    log,
    initialDelay: BASE_DELAY,
  });
  log(`SFTP upload completed in ${uploadTimer.getElapsedTime()}ms`);
}

async function sendViaSftp(
  config: SftpConfig,
  file: string,
  remoteFolderPath: string,
  remoteFileName: string
) {
  if (!config.passwordSecretName) {
    throw new MetriportError("Sftp password secret name is required!", undefined, {
      secretName: config.passwordSecretName,
    });
  }
  const secretName = config.passwordSecretName;

  const region = Config.getAWSRegion();

  const password = await getSecretValueOrFail(secretName, region);

  const client = new SftpClient({
    ...config,
    password,
  });

  await client.connect();
  try {
    const folderExists = await client.exists(remoteFolderPath);
    if (!folderExists) {
      throw new Error("Folder does not exist.");
    }

    const fullPath = `${remoteFolderPath}/${remoteFileName}`;

    await client.write(fullPath, Buffer.from(file, "utf-8"));
  } finally {
    await client.disconnect();
  }
}
