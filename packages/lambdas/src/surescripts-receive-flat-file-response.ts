import { capture } from "./shared/capture";
import { makeSurescriptsClient } from "./shared/surescripts";
import { SurescriptsReceiveResponseHandlerDirect } from "@metriport/core/external/surescripts/command/receive-response/receive-response-direct";

capture.init();

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(
  async ({ transmissionId }: { transmissionId: string }) => {
    const client = await makeSurescriptsClient();
    const handler = new SurescriptsReceiveResponseHandlerDirect(client);
    await handler.receiveResponse({ transmissionId });
  }
);
