import { capture } from "./shared/capture";
import { prefixedLog } from "./shared/log";
import { Config } from "@metriport/core/util/config";
import { SurescriptsSftpClient, Transmission } from "@metriport/core/external/surescripts/client";
import { getSurescriptSecrets } from "./shared/surescripts";

capture.init();

const log = prefixedLog("surescripts");

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(async (transmission: Transmission) => {
  const { surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword } =
    await getSurescriptSecrets();

  const client = new SurescriptsSftpClient({
    production: Config.isCloudEnv(),
    senderPassword: surescriptsSenderPassword,
    publicKey: surescriptsPublicKey,
    privateKey: surescriptsPrivateKey,
  });

  log(`Receiving flat file response for transmission ${transmission.id}`);
  await client.receiveFlatFileResponse(transmission);
  log(`Received flat file response for transmission ${transmission.id}`);
});
