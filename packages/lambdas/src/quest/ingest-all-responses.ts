import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { QuestIngestAllResponsesHandlerDirect } from "@metriport/core/external/quest/command/ingest-all-responses/ingest-all-responses-direct";
import { QuestIngestAllResponsesParams } from "@metriport/core/external/quest/command/ingest-all-responses/ingest-all-responses";
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

export const handler = capture.wrapHandler(async (event: QuestIngestAllResponsesParams) => {
  capture.setExtra({ context: lambdaName });

  const client = await buildQuestClient(questSftpPasswordName);
  const log = prefixedLog("quest.ingest-all-responses");
  const fileNameOverrides = event?.fileNameOverrides;
  const source = fileNameOverrides ? "replica" : "SFTP";
  log(`Starting ingestion of Quest responses from ${source}`);
  const ingestHandler = new QuestIngestAllResponsesHandlerDirect(client);
  await ingestHandler.ingestAllResponses({ fileNameOverrides });
  log("Ingestion of Quest responses completed");
});
