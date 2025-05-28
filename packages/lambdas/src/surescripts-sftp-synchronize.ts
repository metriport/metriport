import { Config } from "@metriport/core/util/config";
import { capture } from "./shared/capture";
import { prefixedLog } from "./shared/log";
import { SurescriptsSftpClient } from "@metriport/core/external/sftp/surescripts/client";
import { SurescriptsReplica } from "@metriport/core/external/sftp/surescripts/replica";
import { getSurescriptSecrets } from "./shared/surescripts";
import { SurescriptsSynchronizeEvent } from "@metriport/core/external/sftp/surescripts/types";

capture.init();

const log = prefixedLog("surescripts");

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(async (event: SurescriptsSynchronizeEvent) => {
  const { surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword } =
    await getSurescriptSecrets();

  const client = new SurescriptsSftpClient({
    production: Config.isCloudEnv(),
    senderPassword: surescriptsSenderPassword,
    publicKey: surescriptsPublicKey,
    privateKey: surescriptsPrivateKey,
  });
  const replica = new SurescriptsReplica({
    sftpClient: client,
    bucket: Config.getSurescriptsReplicaBucketName(),
  });

  await replica.synchronize(event);
  log(`Synchronized surescripts`);
});
