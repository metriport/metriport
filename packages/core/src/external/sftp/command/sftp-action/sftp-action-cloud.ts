import { Config } from "../../../../util/config";
import { makeLambdaClient, getLambdaResultPayload } from "../../../aws/lambda";
import { SftpAction, SftpActionHandler, SftpActionResult } from "./sftp-action";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

export class SftpActionCloud<A extends SftpAction> implements SftpActionHandler<A> {
  constructor(private readonly sftpActionLambdaName: string) {}

  async executeAction(action: A): Promise<{ result?: SftpActionResult<A>; error?: Error }> {
    const payload = JSON.stringify(action);
    try {
      const result = await lambdaClient
        .invoke({
          FunctionName: this.sftpActionLambdaName,
          InvocationType: "RequestResponse",
          Payload: payload,
        })
        .promise();

      const resultPayload = getLambdaResultPayload({
        result,
        lambdaName: this.sftpActionLambdaName,
      });
      return { result: JSON.parse(resultPayload.toString()) as SftpActionResult<A> };
    } catch (error) {
      return {
        error: new Error(`Failed to execute action ${this.sftpActionLambdaName}: ${error}`),
      };
    }
  }
}
