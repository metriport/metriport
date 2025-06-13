import fs from "fs";
import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SftpActionDirect } from "@metriport/core/external/sftp/command/sftp-action/sftp-action-direct";
import { SftpAction } from "@metriport/core/external/sftp/command/sftp-action/sftp-action";

const sftpAction = new Command();

async function executeSftpAction<A extends SftpAction>(action: A) {
  const client = new SurescriptsSftpClient({
    logLevel: "debug",
  });
  const handler = new SftpActionDirect(client);
  return await handler.executeAction(action);
}

sftpAction.name("sftp").description("Execute an SFTP action");

const sftpConnect = new Command();
const sftpList = new Command();
const sftpRead = new Command();
const sftpWrite = new Command();
const sftpExists = new Command();

sftpConnect
  .name("connect")
  .description("Connect to the SFTP server")
  .action(async () => {
    await executeSftpAction({
      type: "connect",
    });
  });

sftpList
  .name("list")
  .argument("<remotePath>", "The remote directory to list files in")
  .option("-p, --prefix <prefix>", "The prefix to filter files by")
  .option("-c, --contains <contains>", "The contains to filter files by")
  .description("List files in the SFTP server")
  .action(
    async (remotePath: string, { prefix, contains }: { prefix?: string; contains?: string }) => {
      await executeSftpAction({
        type: "list",
        remotePath,
        prefix,
        contains,
      });
    }
  );

sftpRead
  .name("read")
  .argument("<remotePath>", "The remote path to read from")
  .option("-d, --decompress", "Decompress the file with gzip")
  .description("Read a file from the SFTP server")
  .action(async (remotePath: string, { decompress }: { decompress?: boolean }) => {
    const { result, error } = await executeSftpAction({
      type: "read",
      remotePath,
      decompress,
    });

    if (result) {
      console.log(result?.toString("ascii"));
    } else if (error) {
      console.error(error.toString());
    }
  });

sftpWrite
  .name("write")
  .argument("<localPath>", "The local path to read from")
  .argument("<remotePath>", "The remote path to write to")
  .option("-c, --compress", "Compress the file with gzip before transmission")
  .description("Write a file to the SFTP server")
  .action(async (localPath: string, remotePath: string, { compress }: { compress?: boolean }) => {
    if (!fs.existsSync(localPath)) {
      throw new Error(`File ${localPath} does not exist`);
    }
    const content = fs.readFileSync(localPath);
    await executeSftpAction({
      type: "write",
      remotePath,
      content,
      compress,
    });
  });

sftpExists
  .name("exists")
  .argument("<remotePath>", "The remote path to check if it exists")
  .description("Check if a file exists in the SFTP server")
  .action(async (remotePath: string) => {
    await executeSftpAction({
      type: "exists",
      remotePath,
    });
  });

sftpAction.addCommand(sftpConnect);
sftpAction.addCommand(sftpList);
sftpAction.addCommand(sftpRead);
sftpAction.addCommand(sftpWrite);
sftpAction.addCommand(sftpExists);

export default sftpAction;
