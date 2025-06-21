import fs from "fs";
import { Command } from "commander";
import { SftpActionDirect } from "@metriport/core/external/sftp/command/sftp-action/sftp-action-direct";
import { SftpAction } from "@metriport/core/external/sftp/command/sftp-action/sftp-action";
import { SftpClient } from "@metriport/core/external/sftp/client";

const sftpAction = new Command();

export function buildSftpAction(client: SftpClient) {
  sftpAction.name("sftp").description("Execute an SFTP action");

  async function executeSftpAction<A extends SftpAction>(action: A) {
    const handler = new SftpActionDirect(client);
    return await handler.executeAction(action);
  }

  const sftpConnect = new Command();
  const sftpList = new Command();
  const sftpRead = new Command();
  const sftpWrite = new Command();
  const sftpExists = new Command();
  const sftpSync = new Command();

  sftpConnect
    .name("connect")
    .description("Connect to the SFTP server")
    .action(async () => {
      const { result, error } = await executeSftpAction({
        type: "connect",
      });

      if (result) {
        console.log("Successfully connected to the SFTP server");
      } else if (error) {
        console.error(error.toString());
      }
    });

  sftpList
    .name("list")
    .argument("<remotePath>", "The remote directory to list files in")
    .option("-p, --prefix <prefix>", "The prefix to filter files by")
    .option("-c, --contains <contains>", "The contains to filter files by")
    .description("List files in the SFTP server")
    .action(
      async (remotePath: string, { prefix, contains }: { prefix?: string; contains?: string }) => {
        const { result, error } = await executeSftpAction({
          type: "list",
          remotePath,
          prefix,
          contains,
        });
        if (result) {
          console.log(result);
        } else if (error) {
          console.error(error.toString());
        }
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
      const content = fs.readFileSync(localPath).toString("base64");
      await executeSftpAction({
        type: "write",
        remotePath,
        content,
        compress,
      });
    });

  sftpSync
    .name("sync")
    .argument("<remotePath>", "The remote path to sync")
    .description("Sync a directory in the SFTP server to the replica")
    .action(async (remotePath: string) => {
      const { result, error } = await executeSftpAction({ type: "sync", remotePath });
      if (result) {
        console.log(`Synced ${result.length} files to the replica`);
        console.log(result.join("\n"));
      } else if (error) {
        console.error(error.toString());
      }
    });

  sftpExists
    .name("exists")
    .argument("<remotePath>", "The remote path to check if it exists")
    .description("Check if a file exists in the SFTP server")
    .action(async (remotePath: string) => {
      const { result, error } = await executeSftpAction({
        type: "exists",
        remotePath,
      });
      if (result) {
        console.log(result);
      } else if (error) {
        console.error(error.toString());
      }
    });

  sftpAction.addCommand(sftpConnect);
  sftpAction.addCommand(sftpList);
  sftpAction.addCommand(sftpRead);
  sftpAction.addCommand(sftpWrite);
  sftpAction.addCommand(sftpExists);
  sftpAction.addCommand(sftpSync);

  return sftpAction;
}
