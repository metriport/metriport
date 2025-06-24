import { Config } from "../../util/config";
import { ConversionFhirHandler } from "./conversion-fhir";
import { ConversionFhirCloud } from "./conversion-fhir-cloud";
import { ConversionFhirDirect } from "./conversion-fhir-direct";

export function buildConversionFhirHandler(): ConversionFhirHandler {
  if (Config.isDev()) {
    const fhirConverterUrl = Config.getFhirConvertServerURL();
    return new ConversionFhirDirect(fhirConverterUrl);
  }
  const nodejsFhirConvertLambdaName = Config.getFhirConverterLambdaName();
  return new ConversionFhirCloud(nodejsFhirConvertLambdaName);
}
