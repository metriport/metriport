import fs from "fs";
import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SftpActionDirect } from "@metriport/core/external/sftp/command/sftp-action/sftp-action-direct";
import { SftpAction } from "@metriport/core/external/sftp/command/sftp-action/sftp-action";

/**
 * Test an SFTP connection to Surescripts. Will only work if it is being run from a server
 * within the VPC corresponding to the environment you are testing (production or staging).
 *
 * Usage:
 * npm run surescripts -- sftp connect
 *
 * You can list all files on the remote SFTP server with:
 *
 * npm run surescripts -- sftp list /path/to/directory
 *
 * You can read a file from the remote SFTP server with:
 *
 * npm run surescripts -- sftp read /path/to/file
 *
 * You can write a file to the remote SFTP server with:
 *
 * npm run surescripts -- sftp write /path/to/local/file /path/to/remote/file
 *
 * Note that you can also write with GZIP compression enabled using the `--compress` flag.
 *
 * You can sync a directory in the SFTP server to an S3 bucket if the associated S3 client has
 * been initialized with `initializeS3Replica`.
 * @see @metriport/core/external/sftp/replica.ts for more details.
 *
 * npm run surescripts -- sftp sync /path/to/remote/directory
 *
 * You can check if a file exists in the SFTP server with:
 *
 * npm run surescripts -- sftp exists /path/to/remote/file
 */
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

export default sftpAction;
