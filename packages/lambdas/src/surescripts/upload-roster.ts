import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { SurescriptsRosterRequest } from "@metriport/core/external/surescripts/command/upload-roster/upload-roster";
import { SurescriptsUploadRosterHandlerDirect } from "@metriport/core/external/surescripts/command/upload-roster/upload-roster-direct";
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
const surescriptsSftpSenderPasswordName = getEnvVarOrFail("SURESCRIPTS_SFTP_SENDER_PASSWORD_NAME");
const surescriptsSftpPublicKeyName = getEnvVarOrFail("SURESCRIPTS_SFTP_PUBLIC_KEY_NAME");
const surescriptsSftpPrivateKeyName = getEnvVarOrFail("SURESCRIPTS_SFTP_PRIVATE_KEY_NAME");

export const handler = capture.wrapHandler(
  async (params: SurescriptsRosterRequest): Promise<void> => {
    capture.setExtra({ context: lambdaName });

    const client = await buildSurescriptsClient({
      surescriptsSftpPublicKeyName,
      surescriptsSftpPrivateKeyName,
      surescriptsSftpSenderPasswordName,
    });
    const log = prefixedLog("surescripts.upload-roster");
    log("Starting upload of Surescripts roster");
    const handler = new SurescriptsUploadRosterHandlerDirect(client);
    await handler.uploadRoster(params);
    log("Upload of Surescripts roster completed");
  }
);
