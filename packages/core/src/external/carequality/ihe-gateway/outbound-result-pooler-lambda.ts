import { Config } from "../../../util/config";
import { processAsyncError } from "../../../util/error/shared";
import { makeLambdaClient } from "../../aws/lambda";
import { OutboundResultPoller, PollOutboundResults } from "./outbound-result-pooler";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

/**
 * Executes lambdas to poll for the results of outbound document query and retrieval requests.
 */
export class OutboundResultPoolerLambda extends OutboundResultPoller {
  private readonly docQueryLambdaName: string | undefined;
  private readonly docRetrievalLambdaName: string | undefined;
  constructor({
    docQueryLambdaName,
    docRetrievalLambdaName,
  }: {
    docQueryLambdaName?: string;
    docRetrievalLambdaName?: string;
  }) {
    super();
    this.docQueryLambdaName = docQueryLambdaName;
    this.docRetrievalLambdaName = docRetrievalLambdaName;
  }

  isDQEnabled(): boolean {
    return (this.docQueryLambdaName ?? "").trim().length > 0;
  }

  async pollOutboundDocQueryResults(params: PollOutboundResults): Promise<void> {
    if (!this.isDQEnabled()) throw new Error(`DQ polling is not enabled`);

    // Intentionally asynchronous.
    lambdaClient
      .invoke({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        FunctionName: this.docQueryLambdaName!, // couldn't make a type guard on isDQEnabled w/ object attributes
        InvocationType: "Event",
        Payload: JSON.stringify(params),
      })
      .promise()
      .catch(
        processAsyncError("Failed to invoke lambda to poll outbound document query responses")
      );
  }

  isDREnabled(): boolean {
    return (this.docRetrievalLambdaName ?? "").trim().length > 0;
  }

  async pollOutboundDocRetrievalResults(params: PollOutboundResults): Promise<void> {
    if (!this.isDREnabled()) throw new Error(`DR polling is not enabled`);

    // Intentionally asynchronous.
    lambdaClient
      .invoke({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        FunctionName: this.docRetrievalLambdaName!, // couldn't make a type guard on isDREnabled w/ object attributes
        InvocationType: "Event",
        Payload: JSON.stringify(params),
      })
      .promise()
      .catch(
        processAsyncError("Failed to invoke lambda to poll outbound document query responses")
      );
  }
}
