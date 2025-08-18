import { LambdaClient, makeLambdaClient, getLambdaResultPayload } from "../../external/aws/lambda";
import { MetriportError } from "@metriport/shared";
import { GenderAtBirth } from "@metriport/shared/domain/gender";
import { RunGenderizeHandler, RunGenderizeRequest } from "./genderize";
import { Config } from "../../util/config";
import { out } from "../../util/log";

export class RunGenderizeCloud implements RunGenderizeHandler {
  constructor(
    private readonly genderizeLambda: string,
    private readonly lambda: LambdaClient = makeLambdaClient(Config.getAWSRegion())
  ) {}

  async execute(request: RunGenderizeRequest): Promise<GenderAtBirth> {
    const payload = JSON.stringify({ body: JSON.stringify({ name: request.name }) });

    const { log } = out(`${request.name}`);

    log("Invoking lambda");
    const result = await this.lambda
      .invoke({
        FunctionName: this.genderizeLambda,
        InvocationType: "RequestResponse",
        Payload: payload,
      })
      .promise();

    const raw = getLambdaResultPayload({ result, lambdaName: this.genderizeLambda });
    const { statusCode, body } = JSON.parse(raw) as { statusCode: number; body: string };
    if (statusCode !== 200) {
      throw new MetriportError(`genderize lambda failed`, undefined, { statusCode, body });
    }

    const { gender } = JSON.parse(body) as { gender: GenderAtBirth };
    return gender;
  }
}
