import { Config } from "../../shared/config";
import { FhirToCdaConverter } from "./connector";
import { FhirToCdaConverterDirect } from "./connector-direct";
import { FhirToCdaConverterLambda } from "./connector-lambda";

export function makeFhirToCdaConverter(): FhirToCdaConverter {
  if (!Config.isCloudEnv()) return new FhirToCdaConverterDirect();
  return new FhirToCdaConverterLambda();
}
