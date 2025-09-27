import { capture } from "./shared/capture";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import { Config } from "@metriport/core/util/config";
import {
  Hl7AlohrSftpIngestionParams,
  log,
} from "@metriport/core/command/hl7-sftp-ingestion/alohr/hl7-alohr-sftp-ingestion";
import { AlohrSftpIngestionClient } from "@metriport/core/command/hl7-sftp-ingestion/alohr/hl7-alohr-sftp-ingestion-client";
import { Hl7AlohrSftpIngestionDirect } from "@metriport/core/command/hl7-sftp-ingestion/alohr/hl7-alohr-sftp-ingestion-direct";

capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(
  async (params: Hl7AlohrSftpIngestionParams): Promise<void> => {
    if (Config.isStaging()) {
      log("Staging environment is not supported (We don't want to ingest PHI in staging)");
      return;
    }
    const secretArn = Config.getHl7Base64ScramblerSeedArn();
    const hl7Base64ScramblerSeed = await getSecretValueOrFail(secretArn, Config.getAWSRegion());
    process.env["HL7_BASE64_SCRAMBLER_SEED"] = hl7Base64ScramblerSeed;
    capture.setExtra({
      context: lambdaName,
      dateTimestamp: params.startingDate,
      endingDate: params.endingDate,
    });
    log("Starting ingestion of Alohr ADTs");
    const sftpClient = await AlohrSftpIngestionClient.create(log);
    const handler = new Hl7AlohrSftpIngestionDirect(sftpClient);
    await handler.execute(params);
    log("Finished ingestion of Alohr");
  }
);
