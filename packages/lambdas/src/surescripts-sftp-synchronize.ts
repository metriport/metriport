import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SurescriptsSynchronizeEvent } from "@metriport/core/external/surescripts/types";
import { capture } from "./shared/capture";
import { prefixedLog } from "./shared/log";
import { getSurescriptSecrets } from "./shared/surescripts";

capture.init();

const log = prefixedLog("surescripts");

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(async (event: SurescriptsSynchronizeEvent) => {
  const { surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword } =
    await getSurescriptSecrets();

  const client = new SurescriptsSftpClient({
    senderPassword: surescriptsSenderPassword,
    publicKey: surescriptsPublicKey,
    privateKey: surescriptsPrivateKey,
  });

  event.debug = log;
  log(`Connecting to Surescripts...`);
  await client.connect();
  log(`Connected to Surescripts`);
  const operations = await client.synchronize(event);
  for (const operation of operations) {
    if (operation.toSurescripts) {
      log(`To Surescripts: ${operation.s3Key} -> ${operation.sftpFileName}`);
    } else if (operation.fromSurescripts) {
      log(`From Surescripts: ${operation.sftpFileName} -> ${operation.s3Key}`);
    } else {
      log(`No transfer: ${operation.sftpFileName}`);
    }
  }
  log(`Synchronized surescripts`);
  await client.disconnect();
  log(`Disconnected from Surescripts`);
});
