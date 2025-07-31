import { QuestReceiveUpdateHandlerDirect } from "@metriport/core/external/quest/command/receive-update/receive-update-direct";
import { capture } from "../shared/capture";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { buildQuestClient } from "./shared";

capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(async () => {
  capture.setExtra({ context: lambdaName });
  const client = await buildQuestClient();
  const receiveUpdateHandler = new QuestReceiveUpdateHandlerDirect(client);
  await receiveUpdateHandler.receiveAllUpdates();
});
