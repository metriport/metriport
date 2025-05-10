import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getLambdaResultPayload, makeLambdaClient } from "../../external/aws/lambda";
import { Config } from "../../util/config";
import {
  ConsolidatedSnapshotConnector,
  ConsolidatedSnapshotRequest,
  ConsolidatedSnapshotRequestAsync,
  ConsolidatedSnapshotRequestSync,
  ConsolidatedSnapshotResponse,
} from "./get-snapshot";

dayjs.extend(duration);

export type ConsolidatedRequestLambda = ConsolidatedSnapshotRequest & {
  bucketName: string;
  apiURL: string;
};

export const TIMEOUT_CALLING_CONVERTER_LAMBDA = dayjs.duration(15, "minutes").add(2, "seconds");

export class ConsolidatedSnapshotConnectorLambda implements ConsolidatedSnapshotConnector {
  readonly lambdaName: string;
  readonly lambdaClient: AWS.Lambda;

  constructor() {
    const region = Config.getAWSRegion();
    this.lambdaName = Config.getFHIRtoBundleLambdaName();
    this.lambdaClient = makeLambdaClient(region, TIMEOUT_CALLING_CONVERTER_LAMBDA.asMilliseconds());
  }

  async execute(
    params: ConsolidatedSnapshotRequestSync | ConsolidatedSnapshotRequestAsync
  ): Promise<ConsolidatedSnapshotResponse> {
    const result = await this.lambdaClient
      .invoke({
        FunctionName: this.lambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(params),
      })
      .promise();
    const resultPayload = getLambdaResultPayload({ result, lambdaName: this.lambdaName });
    const response = JSON.parse(resultPayload) as ConsolidatedSnapshotResponse;
    return response;
  }
}
