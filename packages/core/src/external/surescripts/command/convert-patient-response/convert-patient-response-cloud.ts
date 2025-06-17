import { Config } from "../../../../util/config";
import { executeWithNetworkRetries } from "@metriport/shared";
import { getLambdaResultPayload, makeLambdaClient } from "../../../aws/lambda";
import { SurescriptsConversionBundle, SurescriptsJob } from "../../types";
import { SurescriptsConvertPatientResponseHandler } from "./convert-patient-response";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

export class SurescriptsConvertPatientResponseHandlerCloud
  implements SurescriptsConvertPatientResponseHandler
{
  constructor(private readonly surescriptsConvertPatientResponseLambdaName: string) {}

  async convertPatientResponse(
    job: SurescriptsJob
  ): Promise<SurescriptsConversionBundle | undefined> {
    const payload = JSON.stringify(job);
    let resultPayload: string | undefined;
    await executeWithNetworkRetries(async () => {
      const result = await lambdaClient
        .invoke({
          FunctionName: this.surescriptsConvertPatientResponseLambdaName,
          InvocationType: "RequestResponse",
          Payload: payload,
        })
        .promise();

      resultPayload = getLambdaResultPayload({
        result,
        lambdaName: this.surescriptsConvertPatientResponseLambdaName,
      });
    });

    if (resultPayload) {
      const conversionBundle = JSON.parse(resultPayload);
      return conversionBundle as SurescriptsConversionBundle;
    }
    return undefined;
  }
}
