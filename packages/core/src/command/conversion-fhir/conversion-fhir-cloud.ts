import { Bundle, Resource } from "@medplum/fhirtypes";
import { FhirConverterParams } from "../../domain/conversion/bundle-modifications/modifications";
import { getLambdaResultPayload, LambdaClient, makeLambdaClient } from "../../external/aws/lambda";
import { Config } from "../../util/config";
import { ConversionFhirHandler } from "./conversion-fhir";
import { S3Utils } from "../../external/aws/s3";
import { MetriportError } from "@metriport/shared";

type ConversionResponse = Bundle<Resource> | { s3Key: string; s3BucketName: string };

/**
 * Lambda-based FHIR converter for cloud environments.
 * Invokes the converter Lambda which fetches payload from S3 using params.s3Key.
 */
export class ConversionFhirCloud extends ConversionFhirHandler {
  constructor(
    private readonly nodejsFhirConvertLambdaName: string = Config.getFhirConverterLambdaName(),
    private readonly lambdaClient: LambdaClient = makeLambdaClient(Config.getAWSRegion())
  ) {
    super();
  }

  async callConverter(params: FhirConverterParams): Promise<Bundle<Resource>> {
    const payload = JSON.stringify({
      queryStringParameters: params,
    });
    const result = await this.lambdaClient
      .invoke({
        FunctionName: this.nodejsFhirConvertLambdaName,
        InvocationType: "RequestResponse",
        Payload: payload,
      })
      .promise();
    const resultPayload = getLambdaResultPayload({
      result,
      lambdaName: this.nodejsFhirConvertLambdaName,
    });
    const response = JSON.parse(resultPayload) as { statusCode: number; body: string };
    if (!response.statusCode || response.statusCode < 200 || response.statusCode > 299) {
      throw new MetriportError("FHIR converter returned non-2xx status", undefined, {
        statusCode: response.statusCode,
        body: response.body,
      });
    }

    const body: ConversionResponse = JSON.parse(response.body);
    return await getPayloadFromBody(body);
  }
}

async function getPayloadFromBody(body: ConversionResponse): Promise<Bundle<Resource>> {
  if ("s3Key" in body && "s3BucketName" in body && body.s3Key && body.s3BucketName) {
    const s3Utils = new S3Utils(Config.getAWSRegion());
    const s3Contents = await s3Utils.getFileContentsAsString(body.s3BucketName, body.s3Key);
    return JSON.parse(s3Contents) as Bundle<Resource>;
  }
  return body as Bundle<Resource>;
}
