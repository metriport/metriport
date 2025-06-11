import * as AWS from "aws-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getLambdaResultPayload, makeLambdaClient } from "../../../../external/aws/lambda";
import { Config } from "../../../../util/config";
import {
  SearchConsolidated,
  SearchConsolidatedParams,
  SearchConsolidatedResult,
} from "./search-consolidated";

dayjs.extend(duration);

export const TIMEOUT_CALLING_LAMBDA = dayjs.duration(15, "minutes").add(2, "seconds");

/**
 * Performs a search on a patient's consolidated data using a lambda.
 */
export class SearchConsolidatedLambda implements SearchConsolidated {
  private lambdaClient: AWS.Lambda;

  constructor(
    private readonly region = Config.getAWSRegion(),
    readonly lambdaName = Config.getConsolidatedSearchLambdaName()
  ) {
    this.lambdaClient = makeLambdaClient(this.region, TIMEOUT_CALLING_LAMBDA.asMilliseconds());
  }

  async search({ patient, query }: SearchConsolidatedParams): Promise<SearchConsolidatedResult> {
    const payload: SearchConsolidatedParams = {
      patient,
      query,
    };
    const result = await this.lambdaClient
      .invoke({
        FunctionName: this.lambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(payload),
      })
      .promise();
    const resultPayload = getLambdaResultPayload({ result, lambdaName: this.lambdaName });
    const response = JSON.parse(resultPayload) as SearchConsolidatedResult;
    return response;
  }
}
