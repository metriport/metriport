import { BadRequestError } from "@metriport/shared/dist/error/bad-request";
import { Config } from "../../util/config";
import { ConversionFhirHandler } from "./conversion-fhir";
import { NodejsFhirConvertCloud } from "./conversion-fhir-cloud";

export function buildConversionFhirHandler(): ConversionFhirHandler {
  if (Config.isDev()) {
    throw new BadRequestError("Conversion FHIR is not supported in dev environment");
  }
  const nodejsFhirConvertLambdaName = Config.getNodejsFhirConvertLambdaName();
  return new NodejsFhirConvertCloud(nodejsFhirConvertLambdaName);
}
