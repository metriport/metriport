import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getLambdaResultPayload, makeLambdaClient } from "../../external/aws/lambda";
import { Config } from "../../util/config";
import {
  ConsolidatedDataConnector,
  ConsolidatedDataRequestAsync,
  ConsolidatedDataRequestSync,
  ConsolidatedDataResponse,
  ConsolidatedPatientDataRequest,
} from "./consolidated-connector";

dayjs.extend(duration);

export type ConsolidatedRequestLambda = ConsolidatedPatientDataRequest & {
  bucketName: string;
  apiURL: string;
};

export const TIMEOUT_CALLING_CONVERTER_LAMBDA = dayjs.duration(15, "minutes").add(2, "seconds");

export class ConsolidatedDataConnectorLambda implements ConsolidatedDataConnector {
  lambdaName: string | undefined;
  lambdaClient: AWS.Lambda;
  constructor() {
    const region = Config.getAWSRegion();
    this.lambdaName = Config.getFHIRtoBundleLambdaName();
    this.lambdaClient = makeLambdaClient(region, TIMEOUT_CALLING_CONVERTER_LAMBDA.asMilliseconds());
  }

  async execute(
    params: ConsolidatedDataRequestSync | ConsolidatedDataRequestAsync
  ): Promise<ConsolidatedDataResponse> {
    if (!this.lambdaName) throw new Error("FHIR to Medical Record Lambda Name is undefined");
    const result = await this.lambdaClient
      .invoke({
        FunctionName: this.lambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(params),
      })
      .promise();
    const resultPayload = getLambdaResultPayload({ result, lambdaName: this.lambdaName });
    const response = JSON.parse(resultPayload) as ConsolidatedDataResponse;
    return response;
  }
}
