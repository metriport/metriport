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
  await client.synchronize(event);
  log(`Synchronized surescripts`);
});
