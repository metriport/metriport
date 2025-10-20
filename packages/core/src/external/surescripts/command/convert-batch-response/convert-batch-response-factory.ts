import { Config } from "../../../../util/config";
import { SurescriptsConvertBatchResponseHandler } from "./convert-batch-response";
import { SurescriptsConvertBatchResponseHandlerCloud } from "./convert-batch-response-cloud";
import { SurescriptsConvertBatchResponseHandlerDirect } from "./convert-batch-response-direct";

export function buildConvertBatchResponseHandler(): SurescriptsConvertBatchResponseHandler {
  if (Config.isDev()) {
    return new SurescriptsConvertBatchResponseHandlerDirect();
  }
  const lambdaName = Config.getSurescriptsConvertBatchResponseLambdaName();
  return new SurescriptsConvertBatchResponseHandlerCloud(lambdaName);
}
