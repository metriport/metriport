import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { executeWithNetworkRetries } from "@metriport/shared";
import { getLambdaResultPayloadV3, makeLambdaClientV3 } from "../../../../../external/aws/lambda";
import { Config } from "../../../../../util/config";
import { out } from "../../../../../util/log";
import {
  FhirToCsvTransformHandler,
  FhirToCsvTransformServiceRequest,
  StartFhirToCsvTransformRequest,
} from "./fhir-to-csv-transform";

export type FhirToCsvTransformHttpLambdaRequest = Omit<
  FhirToCsvTransformServiceRequest,
  "INPUT_S3_BUCKET" | "OUTPUT_S3_BUCKET"
>;

export class FhirToCsvTransformCloud implements FhirToCsvTransformHandler {
  constructor(
    private readonly lambdaName: string = Config.getFhirToCsvTransformLambdaName(),
    private readonly region: string = Config.getAWSRegion()
  ) {}

  async startFhirToCsvTransform(
    params: StartFhirToCsvTransformRequest,
    lambdaClientParam?: LambdaClient
  ): Promise<void> {
    const { cxId, patientId, outputPrefix, timeoutInMillis } = params;
    const { log } = out(`FhirToCsvTransformCloud - cx ${cxId} pt ${patientId}`);

    const lambdaClient = lambdaClientParam ?? makeLambdaClientV3(this.region, timeoutInMillis);

    const payload: FhirToCsvTransformHttpLambdaRequest = {
      CX_ID: cxId,
      PATIENT_ID: patientId,
      OUTPUT_PREFIX: outputPrefix,
    };
    const payloadAsString = JSON.stringify(payload);
    log(`Invoking lambda ${this.lambdaName} with payload ${payloadAsString}`);
    const command = new InvokeCommand({
      FunctionName: this.lambdaName,
      InvocationType: "RequestResponse",
      Payload: new TextEncoder().encode(payloadAsString),
    });
    await executeWithNetworkRetries(async () => {
      const result = await lambdaClient.send(command);
      const resultPayload = getLambdaResultPayloadV3({
        result,
        lambdaName: this.lambdaName,
      });
      return JSON.parse(resultPayload);
    });
  }
}
