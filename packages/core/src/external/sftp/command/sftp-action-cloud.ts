import { Config } from "../../../util/config";
import { makeLambdaClient, getLambdaResultPayload } from "../../aws/lambda";
import { SftpActionHandler } from "./sftp-action";
import { SftpAction, SftpActionResult } from "../types";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

export class SftpActionCloud<A extends SftpAction> implements SftpActionHandler<A> {
  constructor(private readonly sftpActionLambdaName: string) {}

  async executeAction(action: A): Promise<SftpActionResult<A>> {
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
    return JSON.parse(resultPayload.toString()) as SftpActionResult<A>;
  }
}
