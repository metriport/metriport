import { Config } from "../../../../util/config";
import { getLambdaResultPayload, makeLambdaClient } from "../../../aws/lambda";
import { SftpAction, SftpActionHandler, SftpActionResult } from "./sftp-action";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

export class SftpActionCloud implements SftpActionHandler {
  constructor(private readonly sftpActionLambdaName: string) {}

  async executeAction<A extends SftpAction>(
    action: A
  ): Promise<{ result?: SftpActionResult<A>; error?: Error }> {
    const payload = JSON.stringify(action);
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
    return { result: JSON.parse(resultPayload) as SftpActionResult<A> };
  }
}
