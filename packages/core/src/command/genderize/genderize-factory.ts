import { Config } from "../../util/config";
import { RunGenderizeHandler } from "./genderize";
import { RunGenderizeCloud } from "./genderize-cloud";
import { RunGenderizeDirect } from "./genderize-direct";

export function buildGenderizeHandler(lambdaName: string): RunGenderizeHandler {
  if (Config.isDev()) {
    return new RunGenderizeDirect();
  }

  return new RunGenderizeCloud(lambdaName);
}
