import * as AWS from "aws-sdk";
import { defaultLambdaInvocationResponseHandler, makeLambdaClient } from "../lambda";
import { DocumentBulkSigner, DocumentBulkSignerRequest } from "./document-bulk-signer";

export class DocumentBulkSignerLambda extends DocumentBulkSigner {
  private lambdaClient: AWS.Lambda;

  constructor(region: string, readonly lambdaName: string) {
    super(region);
    this.lambdaClient = makeLambdaClient(this.region);
  }

  async sign({ patientId, cxId, requestId }: DocumentBulkSignerRequest): Promise<void> {
    const payload: DocumentBulkSignerRequest = {
      patientId: patientId,
      cxId: cxId,
      requestId: requestId,
    };

    await this.lambdaClient
      .invoke({
        FunctionName: this.lambdaName,
        InvocationType: "Event", // async
        Payload: JSON.stringify(payload),
      })
      .promise()
      .then(defaultLambdaInvocationResponseHandler({ lambdaName: this.lambdaName }));
  }
}
