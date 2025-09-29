import { capture } from "./shared/capture";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { Hl7LahieSftpIngestionDirect } from "@metriport/core/command/hl7-sftp-ingestion/hl7-sftp-ingestion-direct";
import {
  Hl7LahieSftpIngestionParams,
  log,
} from "@metriport/core/command/hl7-sftp-ingestion/hl7-sftp-ingestion";
import { LahieSftpIngestionClient } from "@metriport/core/command/hl7-sftp-ingestion/sftp-ingestion-client";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import { Config } from "@metriport/core/util/config";

capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(
  async (params: Hl7LahieSftpIngestionParams): Promise<void> => {
    if (Config.isStaging()) {
      log("Staging environment is not supported (We don't want to ingest PHI in staging)");
      return;
    }
    const secretArn = Config.getHl7Base64ScramblerSeedArn();
    const hl7Base64ScramblerSeed = await getSecretValueOrFail(secretArn, Config.getAWSRegion());
    process.env["HL7_BASE64_SCRAMBLER_SEED"] = hl7Base64ScramblerSeed;
    capture.setExtra({ context: lambdaName, dateTimestamp: params.dateTimestamp });
    log("Starting ingestion of Lahie ADTs");
    const sftpClient = await LahieSftpIngestionClient.create(log);
    const handler = new Hl7LahieSftpIngestionDirect(sftpClient);
    await handler.execute(params);
    log("Finished ingestion of Lahie");
  }
);
