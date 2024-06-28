import {
  getFeatureFlagValueCxValues,
  CxFeatureFlagStatus,
} from "@metriport/core/external/aws/app-config";
import { Config } from "../../shared/config";

export async function getCxFFStatus(cxId: string): Promise<CxFeatureFlagStatus> {
  const region = Config.getAWSRegion();
  const appId = Config.getAppConfigAppId();
  const configId = Config.getAppConfigConfigId();
  const envName = Config.getEnvType();
  return await getFeatureFlagValueCxValues(region, appId, configId, envName, cxId);
}
