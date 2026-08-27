import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { getLambdaResultPayloadV3, makeLambdaClientV3 } from "../../../../../external/aws/lambda";
import { Config } from "../../../../../util/config";
import { out } from "../../../../../util/log";
import { HedisCliHandler, InvokeHedisCliRequest, InvokeHedisCliServiceRequest } from "./hedis-cli";

export class HedisCliCloud implements HedisCliHandler {
  constructor(
    private readonly lambdaName: string = Config.getHedisCliLambdaName(),
    private readonly region: string = Config.getAWSRegion()
  ) {}

  async invokeHedisCli(
    params: InvokeHedisCliRequest,
    lambdaClientParam?: LambdaClient
  ): Promise<void> {
    const {
      patientBundleS3Key,
      measureName,
      outputMeasureReportS3Path,
      mode,
      parameters,
      timeoutInMillis,
    } = params;
    const { log } = out(`HedisCliCloud - measure ${measureName}`);

    const lambdaClient = lambdaClientParam ?? makeLambdaClientV3(this.region, timeoutInMillis);

    const payload: InvokeHedisCliServiceRequest = {
      patientBundleS3Key,
      measureName,
      outputMeasureReportS3Path,
      mode: mode ?? "engine",
      parameters: parameters ?? {},
    };
    const payloadAsString = JSON.stringify(payload);
    log(`Invoking lambda ${this.lambdaName} with payload ${payloadAsString}`);
    const command = new InvokeCommand({
      FunctionName: this.lambdaName,
      InvocationType: "RequestResponse",
      Payload: payloadAsString,
    });
    await executeWithNetworkRetries(async () => {
      const result = await lambdaClient.send(command);
      const resultPayload = getLambdaResultPayloadV3({
        result,
        lambdaName: this.lambdaName,
      });
      try {
        return JSON.parse(resultPayload);
      } catch (error) {
        const errorMessage = errorToString(error);
        log(`Failed to parse Lambda response: ${errorMessage}`);
        throw new MetriportError(`Invalid JSON response from ${this.lambdaName}`, undefined, {
          error: errorMessage,
          resultPayload,
        });
      }
    });
  }
}
