import { SurescriptsConvertBatchResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-batch-response/convert-batch-response-direct";
import { SurescriptsJob } from "@metriport/core/external/surescripts/types";
import { capture } from "../shared/capture";
import { makeSurescriptsReplica } from "./shared";

capture.init();

export const handler = capture.wrapHandler(async (job: SurescriptsJob) => {
  const replica = makeSurescriptsReplica();
  const convertBatchHandler = new SurescriptsConvertBatchResponseHandlerDirect(replica);
  const conversionBundles = await convertBatchHandler.convertBatchResponse(job);
  return { conversionBundles };
});
