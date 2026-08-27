import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { QuestRosterRequest } from "@metriport/core/external/quest/command/upload-roster/upload-roster";
import { QuestUploadRosterHandlerDirect } from "@metriport/core/external/quest/command/upload-roster/upload-roster-direct";
import { Config } from "@metriport/core/util/config";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { capture } from "../shared/capture";
import { prefixedLog } from "../shared/log";
import { buildQuestClient } from "./shared";

capture.init();

FeatureFlags.init(Config.getAWSRegion(), Config.getFeatureFlagsTableName());

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const questSftpPasswordName = getEnvVarOrFail("QUEST_SFTP_PASSWORD_NAME");

export const handler = capture.wrapHandler(async (params: QuestRosterRequest): Promise<void> => {
  capture.setExtra({ context: lambdaName });

  const client = await buildQuestClient(questSftpPasswordName);
  const log = prefixedLog("quest.upload-roster");
  log("Starting upload of Quest roster");
  const handler = new QuestUploadRosterHandlerDirect(client);
  await handler.uploadRoster(params);
  log("Upload of Quest roster completed");
});
