import { SurescriptsVerifyRequestInHistoryHandlerDirect } from "@metriport/core/external/surescripts/command/verify-request-in-history/verify-request-in-history-direct";
import { capture } from "../shared/capture";
import { makeSurescriptsClient } from "./shared";

capture.init();

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(
  async ({ transmissionId }: { transmissionId: string }) => {
    const client = await makeSurescriptsClient();
    const handler = new SurescriptsVerifyRequestInHistoryHandlerDirect(client);
    const result = await handler.verifyRequestInHistory({ transmissionId });
    return { result };
  }
);
