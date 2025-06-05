import { capture } from "./shared/capture";
import { prefixedLog } from "./shared/log";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { getSurescriptSecrets } from "./shared/surescripts";

capture.init();

const log = prefixedLog("surescripts");

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(
  async ({ requestFileName }: { requestFileName: string }) => {
    const { surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword } =
      await getSurescriptSecrets();

    const client = new SurescriptsSftpClient({
      senderPassword: surescriptsSenderPassword,
      publicKey: surescriptsPublicKey,
      privateKey: surescriptsPrivateKey,
    });

    await client.connect();
    log("Connected to Surescripts");

    const response = await client.receiveVerificationResponse(requestFileName);
    if (response) {
      log("Received verification response");
      log(`Verification file name: ${response.verificationFileName}`);
      log(`Verification file size: ${response.verificationFileContent.length} bytes`);
    } else {
      log("No verification response found");
    }

    await client.disconnect();
    log("Disconnected from Surescripts");
  }
);
