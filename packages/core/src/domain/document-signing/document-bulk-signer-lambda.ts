import * as AWS from "aws-sdk";
import { makeLambdaClient } from "../../external/aws/lambda";
import { DocumentBulkSigner, DocumentBulkSignerRequest } from "./document-bulk-signer";

export class DocumentBulkSignerLambda extends DocumentBulkSigner {
  private lambdaClient: AWS.Lambda;

  constructor(region: string, readonly lambdaName: string) {
    super(region);
    this.lambdaClient = makeLambdaClient(this.region);
  }

  async sign({ patientId, cxId, requestId }: DocumentBulkSignerRequest) {
    const payload: DocumentBulkSignerRequest = {
      patientId: patientId,
      cxId: cxId,
      requestId: requestId,
    };

    this.lambdaClient
      .invoke({
        FunctionName: this.lambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(payload),
      })
      .promise()
      .catch(error => {
        console.log(
          `Error invoking lambda ${this.lambdaName} with error ${JSON.stringify(
            error
          )}. The lambda name is likely wrong`
        );
      });
  }
}
