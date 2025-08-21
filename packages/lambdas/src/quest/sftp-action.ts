import { SftpAction } from "@metriport/core/external/sftp/command/sftp-action/sftp-action";
import { SftpActionDirect } from "@metriport/core/external/sftp/command/sftp-action/sftp-action-direct";
import { capture } from "../shared/capture";
import { buildQuestClient } from "./shared";

capture.init();

export const handler = capture.wrapHandler(async (event: SftpAction) => {
  const client = await buildQuestClient();
  const sftpActionHandler = new SftpActionDirect(client);
  const result = await sftpActionHandler.executeAction(event);
  return result;
});
