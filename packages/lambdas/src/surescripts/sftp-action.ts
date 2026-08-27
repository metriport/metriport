import { SftpAction } from "@metriport/core/external/sftp/command/sftp-action/sftp-action";
import { SftpActionDirect } from "@metriport/core/external/sftp/command/sftp-action/sftp-action-direct";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { capture } from "../shared/capture";
import { buildSurescriptsClient } from "./shared";

capture.init();

// Set by us
const surescriptsSftpPublicKeyName = getEnvVarOrFail("SURESCRIPTS_SFTP_PUBLIC_KEY_NAME");
const surescriptsSftpPrivateKeyName = getEnvVarOrFail("SURESCRIPTS_SFTP_PRIVATE_KEY_NAME");
const surescriptsSftpSenderPasswordName = getEnvVarOrFail("SURESCRIPTS_SFTP_SENDER_PASSWORD_NAME");

export const handler = capture.wrapHandler(async (event: SftpAction) => {
  const client = await buildSurescriptsClient({
    surescriptsSftpPublicKeyName,
    surescriptsSftpPrivateKeyName,
    surescriptsSftpSenderPasswordName,
  });
  const sftpActionHandler = new SftpActionDirect(client);
  const result = await sftpActionHandler.executeAction(event);
  return result;
});
