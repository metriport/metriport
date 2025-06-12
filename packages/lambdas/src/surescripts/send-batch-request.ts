import { SurescriptsBatchRequest } from "@metriport/core/external/surescripts/types";
import { SurescriptsSendBatchRequestHandlerDirect } from "@metriport/core/external/surescripts/command/send-batch-request/send-batch-request-direct";
import { capture } from "../shared/capture";
import { makeSurescriptsClient } from "./shared";

capture.init();

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(async (event: SurescriptsBatchRequest) => {
  const client = await makeSurescriptsClient();
  const handler = new SurescriptsSendBatchRequestHandlerDirect(client);
  await handler.sendBatchRequest(event);
});
