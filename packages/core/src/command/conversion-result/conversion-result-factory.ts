import { getEnvVarOrFail } from "@metriport/shared";
import { Config } from "../../util/config";
import { ConversionResultHandler } from "./types";
import { ConversionResultCloud } from "./conversion-result-cloud";
import { ConversionResultLocal } from "./conversion-result-local";

export function buildConversionResultHandler(): ConversionResultHandler {
  if (Config.isDev()) {
    const apiUrl = getEnvVarOrFail("API_URL");
    return new ConversionResultLocal(apiUrl);
  }
  const region = getEnvVarOrFail("AWS_REGION");
  const conversionResultQueueUrl = getEnvVarOrFail("CONVERSION_RESULT_QUEUE_URL");
  return new ConversionResultCloud(region, conversionResultQueueUrl);
}
