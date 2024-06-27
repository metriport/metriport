import { Config } from "../../../util/config";
import { processAsyncError } from "../../../util/error/shared";
import { defaultLambdaInvocationResponseHandler, makeLambdaClient } from "../../aws/lambda";
import { OutboundResultPoller, PollOutboundResults } from "./outbound-result-poller";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

/**
 * Executes lambdas to poll for the results of outbound document query and retrieval requests.
 */
export class OutboundResultPollerLambda extends OutboundResultPoller {
  private readonly patientDiscoveryLambdaName: string | undefined;
  private readonly docQueryLambdaName: string | undefined;
  private readonly docRetrievalLambdaName: string | undefined;
  constructor({
    patientDiscoveryLambdaName,
    docQueryLambdaName,
    docRetrievalLambdaName,
  }: {
    patientDiscoveryLambdaName?: string;
    docQueryLambdaName?: string;
    docRetrievalLambdaName?: string;
  }) {
    super();
    this.patientDiscoveryLambdaName = patientDiscoveryLambdaName;
    this.docQueryLambdaName = docQueryLambdaName;
    this.docRetrievalLambdaName = docRetrievalLambdaName;
  }

  isPDEnabled(
    lambdaName: string | undefined = this.patientDiscoveryLambdaName
  ): lambdaName is string {
    return (lambdaName ?? "").trim().length > 0;
  }

  async pollOutboundPatientDiscoveryResults(params: PollOutboundResults): Promise<void> {
    if (!this.isPDEnabled(this.patientDiscoveryLambdaName))
      throw new Error(`PD polling is not enabled`);

    // Intentionally asynchronous.
    lambdaClient
      .invoke({
        FunctionName: this.patientDiscoveryLambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify(params),
      })
      .promise()
      .then(
        defaultLambdaInvocationResponseHandler({
          lambdaName: this.patientDiscoveryLambdaName,
        })
      )
      .catch(
        processAsyncError("Failed to invoke lambda to poll outbound patient discovery responses")
      );
  }

  isDQEnabled(lambdaName: string | undefined = this.docQueryLambdaName): lambdaName is string {
    return (lambdaName ?? "").trim().length > 0;
  }

  async pollOutboundDocQueryResults(params: PollOutboundResults): Promise<void> {
    if (!this.isDQEnabled(this.docQueryLambdaName)) throw new Error(`DQ polling is not enabled`);

    // Intentionally asynchronous.
    lambdaClient
      .invoke({
        FunctionName: this.docQueryLambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify(params),
      })
      .promise()
      .then(
        defaultLambdaInvocationResponseHandler({
          lambdaName: this.docQueryLambdaName,
        })
      )
      .catch(
        processAsyncError("Failed to invoke lambda to poll outbound document query responses")
      );
  }

  isDREnabled(lambdaName: string | undefined = this.docRetrievalLambdaName): lambdaName is string {
    return (lambdaName ?? "").trim().length > 0;
  }

  async pollOutboundDocRetrievalResults(params: PollOutboundResults): Promise<void> {
    if (!this.isDREnabled(this.docRetrievalLambdaName))
      throw new Error(`DR polling is not enabled`);

    // Intentionally asynchronous.
    lambdaClient
      .invoke({
        FunctionName: this.docRetrievalLambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify(params),
      })
      .promise()
      .then(
        defaultLambdaInvocationResponseHandler({
          lambdaName: this.docRetrievalLambdaName,
        })
      )
      .catch(
        processAsyncError("Failed to invoke lambda to poll outbound document query responses")
      );
  }
}
