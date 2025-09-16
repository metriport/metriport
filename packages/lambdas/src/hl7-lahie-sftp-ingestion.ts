import { capture } from "./shared/capture";
import { prefixedLog } from "./shared/log";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { Hl7LahieSftpIngestionDirect } from "@metriport/core/command/hl7-sftp-ingestion/hl7-sftp-ingestion-direct";
import { Hl7LahieSftpIngestionParams } from "@metriport/core/command/hl7-sftp-ingestion/hl7-sftp-ingestion";
import { LahieSftpIngestionClient } from "@metriport/core/command/hl7-sftp-ingestion/sftp-ingestion-client";

capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(
  async (params: Hl7LahieSftpIngestionParams): Promise<void> => {
    capture.setExtra({ context: lambdaName, dateTimestamp: params.dateTimestamp });
    const log = prefixedLog("Lahie-ingestion");
    log("Starting ingestion of Lahie ADTs");
    const sftpClient = await LahieSftpIngestionClient.create(log);
    const handler = new Hl7LahieSftpIngestionDirect(sftpClient, log);
    await handler.execute(params);
    log("Finished ingestion of Lahie");
  }
);
