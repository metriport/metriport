import { MetriportError } from "@metriport/shared";
import { SalesforceEnv, isSalesforceEnv } from ".";
import { Config } from "../../../util/config";

export function getSalesforceEnv(): {
  environment: SalesforceEnv;
} {
  const environment = Config.getSalesforceEnv();
  if (!environment) throw new MetriportError("Salesforce environment not set");
  if (!isSalesforceEnv(environment)) {
    throw new MetriportError("Invalid Salesforce environment", undefined, { environment });
  }
  return {
    environment,
  };
}
