import { out } from "../../util";
import { HieConfig, VpnlessHieConfig } from "./types";
import { SftpClient } from "../../external/sftp/client";
import { executeWithRetries } from "@metriport/shared/common/retry";
import { SftpConfig } from "../../external/sftp/types";
import { createFileHl7v2Roster } from "./hl7v2-roster-generator";

const NUMBER_OF_ATTEMPTS = 3;
const BASE_DELAY = 1000;

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

  await executeWithRetries(
    () => sendViaSftp(config.sftpConfig, file, config.remotePath, remoteFileName),
    {
      maxAttempts: NUMBER_OF_ATTEMPTS,
      log,
      maxDelay: BASE_DELAY,
    }
  );
  log("Done");
  return;
}

async function sendViaSftp(
  config: SftpConfig | undefined,
  file: string,
  remoteFolderPath: string | undefined,
  remoteFileName: string
) {
  if (!config || !remoteFolderPath) {
    throw new Error("Sftp config is required");
  }
  const client = new SftpClient(config);

  await client.connect();

  const folderExists = await client.exists(remoteFolderPath);
  if (!folderExists) {
    throw new Error("Folder does not exist.");
  }

  const fullPath = `${remoteFolderPath}/${remoteFileName}`;

  await client.write(fullPath, Buffer.from(file, "utf-8"));

  await client.disconnect();
}
