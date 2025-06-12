import { SurescriptsReceiveVerificationHandlerDirect } from "@metriport/core/external/surescripts/command/receive-verification/receive-verification-direct";
import { capture } from "../shared/capture";
import { makeSurescriptsClient } from "./shared";

capture.init();

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(
  async ({ transmissionId }: { transmissionId: string }) => {
    const client = await makeSurescriptsClient();
    const handler = new SurescriptsReceiveVerificationHandlerDirect(client);
    await handler.receiveVerification({ transmissionId });
  }
);
