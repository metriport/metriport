import { out } from "../../util";
import { HieConfig } from "./types";

// import { errorToString, executeWithNetworkRetries } from "@metriport/shared";
// import dayjs from "dayjs";
// import { capture, out } from "../../util";
// import { HieConfig, SftpConfig } from "./types";
// import Client from "ssh2-sftp-client";

// const NUMBER_OF_ATTEMPTS = 3;
// const BASE_DELAY = dayjs.duration({ seconds: 1 });

// TODO: ENG-24 - uncomment and implement when SFTP upload becomes part of the flow
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function uploadThroughSftp(config: HieConfig, file: string): Promise<void> {
  const { log } = out("[STUB] - Hl7v2RosterUploader");
  // const { states, subscriptions } = config;
  // const loggingDetails = {
  //   hieName: config.name,
  //   schema: config.schema,
  //   states,
  //   subscriptions,
  // };
  // log(`Running with this config: ${JSON.stringify(loggingDetails)}`);
  // const sftpConfig = config.sftpConfig;
  // if (sftpConfig) {
  //     await executeWithNetworkRetries(async () => sendViaSftp(sftpConfig, file, log), {
  //       maxAttempts: NUMBER_OF_ATTEMPTS,
  //       initialDelay: BASE_DELAY.asMilliseconds(),
  //       log,
  //     });
  // }

  log("Done");
  return;
}

// async function sendViaSftp(
//   config: SftpConfig,
//   rosterCsv: string,
//   log: typeof console.log
// ): Promise<void> {
//   const sftp = new Client();

//   try {
//     log(`[SFTP] Uploading roster to ${config.host}:${config.port}${config.remotePath}`);

//     await sftp.connect({
//       host: config.host,
//       port: config.port,
//       username: config.username,
//       password: config.password,
//     });
//     log(`[SFTP] Successfully established connection :)`);

//     const dirPath = config.remotePath.substring(0, config.remotePath.lastIndexOf("/"));
//     if (dirPath) {
//       await sftp.mkdir(dirPath, true);
//       log(`[SFTP] Successfully created/verified directory structure`);
//     }

//     await sftp.put(Buffer.from(rosterCsv), config.remotePath);
//     log("[SFTP] Upload successful!");

//     return;
//   } catch (error) {
//     log(`[SFTP] SFTP failed! ${errorToString(error)}`);
//     throw error;
//   } finally {
//     await sftp.end();
//     log(`[SFTP] Connection cleaned up.`);
//   }
// }
