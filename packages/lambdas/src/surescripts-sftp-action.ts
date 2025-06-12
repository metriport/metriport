import { capture } from "./shared/capture";
import { makeSurescriptsClient } from "./shared/surescripts";
import { SftpActionDirect } from "@metriport/core/external/sftp/command/sftp-action-direct";
import { SftpAction } from "@metriport/core/external/sftp/types";

capture.init();

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(async (event: SftpAction) => {
  const client = await makeSurescriptsClient();
  const handler = new SftpActionDirect(client);
  const result = await handler.executeAction(event);
  return result;
});
