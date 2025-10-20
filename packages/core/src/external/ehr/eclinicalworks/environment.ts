import { MetriportError } from "@metriport/shared";
import { EClinicalWorksEnv, isEClinicalWorksEnv } from ".";
import { Config } from "../../../util/config";

export function getEClinicalWorksEnv(): {
  environment: EClinicalWorksEnv;
} {
  const environment = Config.getEClinicalWorksEnv();
  if (!environment) throw new MetriportError("EClinicalWorks environment not set");
  if (!isEClinicalWorksEnv(environment)) {
    throw new MetriportError("Invalid EClinicalWorks environment", undefined, { environment });
  }
  return {
    environment,
  };
}
