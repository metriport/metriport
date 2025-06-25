import { Config } from "../../../util/config";
import { DischargeRequery } from "./discharge-requery";
import { DischargeRequeryCloud } from "./discharge-requery-cloud";
import { DischargeRequeryDirect } from "./discharge-requery-direct";

export function buildDischargeRequeryHandler(): DischargeRequery {
  if (Config.isDev()) {
    return new DischargeRequeryDirect();
  }
  return new DischargeRequeryCloud();
}
