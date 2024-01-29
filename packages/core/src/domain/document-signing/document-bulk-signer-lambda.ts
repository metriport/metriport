import * as AWS from "aws-sdk";
import { makeLambdaClient } from "../../external/aws/lambda";
import { DocumentBulkSigner, DocumentBulkSignerRequest } from "./document-bulk-signer";
import { errorToString } from "../../util/error";

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

    return this.lambdaClient
      .invoke({
        FunctionName: this.lambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(payload),
      })
      .promise()
      .then(() => undefined)
      .catch(error => {
        console.log(
          `Error invoking lambda ${this.lambdaName} with error ${errorToString(
            error
          )}. The lambda name is likely wrong`
        );
        throw error;
      });
  }
}
