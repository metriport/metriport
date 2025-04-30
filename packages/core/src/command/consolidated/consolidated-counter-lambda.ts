import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getLambdaResultPayload, makeLambdaClient } from "../../external/aws/lambda";
import { Config } from "../../util/config";
import {
  ConsolidatedCounter,
  ConsolidatedCounterRequest,
  ConsolidatedCounterResponse,
} from "./consolidated-counter";

dayjs.extend(duration);

export const lambdaExecutionTimeout = dayjs.duration(15, "minutes").add(2, "seconds");

export class ConsolidatedCounterLambda implements ConsolidatedCounter {
  readonly lambdaClient: AWS.Lambda;
  constructor(
    region = Config.getAWSRegion(),
    private readonly lambdaName = Config.getFHIRtoBundleCountLambdaName()
  ) {
    this.lambdaClient = makeLambdaClient(region, lambdaExecutionTimeout.asMilliseconds());
  }

  async execute(params: ConsolidatedCounterRequest): Promise<ConsolidatedCounterResponse> {
    const result = await this.lambdaClient
      .invoke({
        FunctionName: this.lambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(params),
      })
      .promise();
    const resultPayload = getLambdaResultPayload({ result, lambdaName: this.lambdaName });
    const response = JSON.parse(resultPayload) as ConsolidatedCounterResponse;
    return response;
  }
}
