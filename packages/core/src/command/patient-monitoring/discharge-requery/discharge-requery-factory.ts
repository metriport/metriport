import { Config } from "../../../util/config";
import { DischargeRequery } from "./discharge-requery";
import { DischargeRequeryCloud } from "./discharge-requery-cloud";
import { DischargeRequeryLocal } from "./discharge-requery-local";

export function buildDischargeRequeryHandler(): DischargeRequery {
  if (Config.isDev() || Config.isSandbox()) {
    return new DischargeRequeryLocal();
  }
  const lambdaName = Config.getDischargeRequeryLambdaName();
  if (!lambdaName) throw new Error("Discharge Requery Lambda Name is undefined");

  return new DischargeRequeryCloud(lambdaName);
}
