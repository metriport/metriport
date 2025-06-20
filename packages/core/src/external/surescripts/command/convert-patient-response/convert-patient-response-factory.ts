import { Config } from "../../../../util/config";
import { SurescriptsConvertPatientResponseHandler } from "./convert-patient-response";
import { SurescriptsConvertPatientResponseHandlerCloud } from "./convert-patient-response-cloud";
import { SurescriptsConvertPatientResponseHandlerDirect } from "./convert-patient-response-direct";

export function buildConvertPatientResponseHandler(): SurescriptsConvertPatientResponseHandler {
  if (Config.isDev()) {
    return new SurescriptsConvertPatientResponseHandlerDirect();
  }
  const lambdaName = Config.getSurescriptsConvertPatientResponseLambdaName();
  return new SurescriptsConvertPatientResponseHandlerCloud(lambdaName);
}
