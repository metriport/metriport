import { MetriportError } from "@metriport/shared";
import { EpicEnv, isEpicEnv } from ".";
import { Config } from "../../../util/config";

export function getEpicEnv(): {
  environment: EpicEnv;
} {
  const environment = Config.getEpicEnv();
  if (!environment) throw new MetriportError("Epic environment not set");
  if (!isEpicEnv(environment)) {
    throw new MetriportError("Invalid Epic environment", undefined, { environment });
  }
  return {
    environment,
  };
}
