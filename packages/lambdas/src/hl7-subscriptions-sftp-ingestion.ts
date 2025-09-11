import { capture } from "./shared/capture";
import { prefixedLog } from "./shared/log";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { Hl7SubscriptionLaHieIngestionDirect } from "@metriport/core/command/hl7v2-subscriptions/hl7-subscriptions-sftp-ingestion/hl7-notification-sftp-ingestion-direct";
import { SftpIngestionClient } from "@metriport/core/command/hl7v2-subscriptions/hl7-subscriptions-sftp-ingestion/sftp-ingestion-client";

capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(async () => {
  capture.setExtra({ context: lambdaName });
  const log = prefixedLog("LaHie-ingestion");
  log("Starting ingestion of LaHie ADTs");
  const sftpClient = await SftpIngestionClient.create(log);
  const handler = new Hl7SubscriptionLaHieIngestionDirect(sftpClient, log);
  await handler.execute();
  log("Finished ingestion of LaHie");
});
