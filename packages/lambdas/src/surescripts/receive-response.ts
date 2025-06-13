import { SurescriptsReceiveResponseHandlerDirect } from "@metriport/core/external/surescripts/command/receive-response/receive-response-direct";
import { SurescriptsFileIdentifier } from "@metriport/core/external/surescripts/types";
import { capture } from "../shared/capture";
import { makeSurescriptsClient } from "./shared";

capture.init();

export const handler = capture.wrapHandler(
  async ({ transmissionId, populationId }: SurescriptsFileIdentifier) => {
    const client = await makeSurescriptsClient();
    const handler = new SurescriptsReceiveResponseHandlerDirect(client);
    await handler.receiveResponse({ transmissionId, populationId });
  }
);
