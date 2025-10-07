import { capture } from "../shared/capture";
import { prefixedLog } from "../shared/log";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { QuestUploadRosterHandlerDirect } from "@metriport/core/external/quest/command/upload-roster/upload-roster-direct";
import { QuestRosterType } from "@metriport/core/external/quest/types";

capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");

interface QuestUploadRosterEvent {
  rosterType: QuestRosterType;
}

export const handler = capture.wrapHandler(async ({ rosterType }: QuestUploadRosterEvent) => {
  capture.setExtra({ context: lambdaName });

  const log = prefixedLog("quest.upload-roster");
  log("Starting upload of Quest roster");
  const handler = new QuestUploadRosterHandlerDirect();
  await handler.generateAndUploadLatestQuestRoster({ rosterType });
  log("Upload of Quest roster completed");
});
