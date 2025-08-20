import { out } from "../../util";
import { HieConfig, VpnlessHieConfig } from "./types";
import { SftpClient } from "../../external/sftp/client";
import { executeWithRetries } from "@metriport/shared/common/retry";
import { SftpConfig } from "../../external/sftp/types";
import { createFileHl7v2Roster } from "./hl7v2-roster-generator";
import { getSecretValueOrFail } from "../../external/aws/secret-manager";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { MetriportError } from "@metriport/shared";

const NUMBER_OF_ATTEMPTS = 3;
const BASE_DELAY = 1000;
const AWS_REGION = getEnvVarOrFail("AWS_REGION");

// TODO: ENG-24 - uncomment and implement when SFTP upload becomes part of the flow

export async function uploadThroughSftp(
  config: HieConfig | VpnlessHieConfig,
  file: string
): Promise<void> {
  const { log } = out("[STUB] - Hl7v2RosterUploader");

  const loggingDetails = {
    hieName: config.name,
    sftpConfig: config.sftpConfig,
    remotePath: config.remotePath,
  };
  log(`Running with this config: ${JSON.stringify(loggingDetails)}`);

  const hieName = config.name;

  const remoteFileName = createFileHl7v2Roster(hieName);
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
    maxDelay: BASE_DELAY,
  });
  log("Done");
  return;
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
  const password = await getSecretValueOrFail(secretName, AWS_REGION);

  const client = new SftpClient({
    host: config.host,
    port: config.port,
    username: config.username,
    password,
  });

  await client.connect();

  const folderExists = await client.exists(remoteFolderPath);
  if (!folderExists) {
    throw new Error("Folder does not exist.");
  }

  const fullPath = `${remoteFolderPath}/${remoteFileName}`;

  await client.write(fullPath, Buffer.from(file, "utf-8"));

  await client.disconnect();
}
