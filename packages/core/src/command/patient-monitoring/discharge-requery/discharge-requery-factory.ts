import { Config } from "../../../util/config";
import { DischargeRequery } from "./discharge-requery";
import { DischargeRequeryCloud } from "./discharge-requery-cloud";
import { DischargeRequeryLocal } from "./discharge-requery-local";

export function buildDischargeRequeryHandler(): DischargeRequery {
  if (Config.isDev()) {
    return new DischargeRequeryLocal();
  }
  const lambdaName = Config.getDischargeRequeryLambdaName();
  return new DischargeRequeryCloud(lambdaName);
}
