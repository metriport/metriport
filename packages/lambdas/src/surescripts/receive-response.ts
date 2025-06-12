import { SurescriptsReceiveResponseHandlerDirect } from "@metriport/core/external/surescripts/command/receive-response/receive-response-direct";
import { SurescriptsFileIdentifier } from "@metriport/core/external/surescripts/types";
import { capture } from "../shared/capture";
import { makeSurescriptsClient } from "./shared";

capture.init();

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(
  async ({ transmissionId, populationOrPatientId }: SurescriptsFileIdentifier) => {
    const client = await makeSurescriptsClient();
    const handler = new SurescriptsReceiveResponseHandlerDirect(client);
    await handler.receiveResponse({ transmissionId, populationOrPatientId });
  }
);
