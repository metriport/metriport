import { capture } from "../shared/capture";
import { prefixedLog } from "../shared/log";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { DownloadResponseHandlerDirect } from "@metriport/core/external/quest/command/download-response/download-response-direct";

capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(async () => {
  capture.setExtra({ context: lambdaName });
  const log = prefixedLog("quest.download-response");
  log("Starting download of Quest responses");
  const handler = new DownloadResponseHandlerDirect();
  await handler.downloadAllQuestResponses();
  log("Download of all new Quest responses completed");
});
