import { SftpAction } from "@metriport/core/external/sftp/command/sftp-action/sftp-action";
import { SftpActionDirect } from "@metriport/core/external/sftp/command/sftp-action/sftp-action-direct";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { capture } from "../shared/capture";
import { buildQuestClient } from "./shared";

capture.init();

// Set by us
const questSftpPasswordName = getEnvVarOrFail("QUEST_SFTP_PASSWORD_NAME");

export const handler = capture.wrapHandler(async (event: SftpAction) => {
  const client = await buildQuestClient(questSftpPasswordName);
  const sftpActionHandler = new SftpActionDirect(client);
  const result = await sftpActionHandler.executeAction(event);
  return result;
});
