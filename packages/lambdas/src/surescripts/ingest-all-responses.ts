import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { SurescriptsIngestAllResponsesHandlerDirect } from "@metriport/core/external/surescripts/command/ingest-all-responses/ingest-all-responses-direct";
import { SurescriptsIngestAllResponsesParams } from "@metriport/core/external/surescripts/command/ingest-all-responses/ingest-all-responses";
import { Config } from "@metriport/core/util/config";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { capture } from "../shared/capture";
import { prefixedLog } from "../shared/log";
import { buildSurescriptsClient } from "./shared";

capture.init();

FeatureFlags.init(Config.getAWSRegion(), Config.getFeatureFlagsTableName());

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const surescriptsSftpPublicKeyName = getEnvVarOrFail("SURESCRIPTS_SFTP_PUBLIC_KEY_NAME");
const surescriptsSftpPrivateKeyName = getEnvVarOrFail("SURESCRIPTS_SFTP_PRIVATE_KEY_NAME");
const surescriptsSftpSenderPasswordName = getEnvVarOrFail("SURESCRIPTS_SFTP_SENDER_PASSWORD_NAME");

export const handler = capture.wrapHandler(async (event: SurescriptsIngestAllResponsesParams) => {
  capture.setExtra({ context: lambdaName });

  const client = await buildSurescriptsClient({
    surescriptsSftpPublicKeyName,
    surescriptsSftpPrivateKeyName,
    surescriptsSftpSenderPasswordName,
  });
  const log = prefixedLog("surescripts.ingest-all-responses");
  const fileNameOverrides = event?.fileNameOverrides;
  const source = fileNameOverrides ? "replica" : "SFTP";
  log(`Starting ingestion of Surescripts responses from ${source}`);
  const ingestHandler = new SurescriptsIngestAllResponsesHandlerDirect(client);
  await ingestHandler.ingestAllResponses({ fileNameOverrides });
  log("Ingestion of Surescripts responses completed");
});
