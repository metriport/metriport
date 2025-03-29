import { getFeatureFlagValueCxValues } from "@metriport/core/command/feature-flags";
import { CxFeatureFlagStatus } from "@metriport/core/command/feature-flags/types";
import { Config as ConfigCore } from "@metriport/core/util/config";
import { Config } from "../../shared/config";

export async function getCxFFStatus(cxId: string): Promise<CxFeatureFlagStatus> {
  const region = Config.getAWSRegion();
  const featureFlagsTableName = ConfigCore.getFeatureFlagsTableName();
  return await getFeatureFlagValueCxValues(region, featureFlagsTableName, cxId);
}
