import { Config } from "../../../../util/config";
import { SurescriptsReplica } from "../../replica";
import { SurescriptsConvertPatientResponseHandler } from "./convert-patient-response";
import { SurescriptsConvertPatientResponseHandlerCloud } from "./convert-patient-response-cloud";
import { SurescriptsConvertPatientResponseHandlerDirect } from "./convert-patient-response-direct";

export function buildConvertPatientResponseHandler(): SurescriptsConvertPatientResponseHandler {
  if (Config.isDev()) {
    return new SurescriptsConvertPatientResponseHandlerDirect(new SurescriptsReplica());
  }
  const lambdaName = Config.getSurescriptsConvertPatientResponseLambdaName();
  return new SurescriptsConvertPatientResponseHandlerCloud(lambdaName);
}
