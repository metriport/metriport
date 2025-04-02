import { getFeatureFlagValueCxValues } from "@metriport/core/command/feature-flags/domain-ffs";
import { CxFeatureFlagStatus } from "@metriport/core/command/feature-flags/types";

export async function getCxFFStatus(cxId: string): Promise<CxFeatureFlagStatus> {
  return await getFeatureFlagValueCxValues(cxId);
}
