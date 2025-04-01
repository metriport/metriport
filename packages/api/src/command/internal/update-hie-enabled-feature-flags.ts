import {
  getFeatureFlags,
  updateFeatureFlags,
} from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { CxFeatureFlagStatus, StringValuesFF } from "@metriport/core/command/feature-flags/types";
import { Config as ConfigCore } from "@metriport/core/util/config";
import { out } from "@metriport/core/util/log";
import { Config } from "../../shared/config";

function enableFeatureFlagForCustomer(flag: StringValuesFF, cxId: string) {
  flag.values.push(cxId);
}

function disableFeatureFlagForCustomer(flag: StringValuesFF, cxId: string) {
  flag.values = flag.values.filter(id => id !== cxId);
}

function deduplicateFeatureFlagValues(flag: StringValuesFF) {
  flag.values = [...new Set(flag.values)];
}

export async function updateCxHieEnabledFFs({
  cxId,
  cwEnabled,
  cqEnabled,
  epicEnabled,
  demoAugEnabled,
}: {
  cxId: string;
  cwEnabled?: boolean;
  cqEnabled?: boolean;
  epicEnabled?: boolean;
  demoAugEnabled?: boolean;
}): Promise<CxFeatureFlagStatus> {
  const region = Config.getAWSRegion();
  const featureFlagsTableName = ConfigCore.getFeatureFlagsTableName();
  const featureFlags = await getFeatureFlags(region, featureFlagsTableName);
  if (cwEnabled === true) {
    enableFeatureFlagForCustomer(featureFlags.cxsWithCWFeatureFlag, cxId);
  } else if (cwEnabled === false) {
    disableFeatureFlagForCustomer(featureFlags.cxsWithCWFeatureFlag, cxId);
  }
  if (cqEnabled === true) {
    enableFeatureFlagForCustomer(featureFlags.cxsWithCQDirectFeatureFlag, cxId);
  } else if (cqEnabled === false) {
    disableFeatureFlagForCustomer(featureFlags.cxsWithCQDirectFeatureFlag, cxId);
  }
  if (epicEnabled === true) {
    enableFeatureFlagForCustomer(featureFlags.cxsWithEpicEnabled, cxId);
  } else if (epicEnabled === false) {
    disableFeatureFlagForCustomer(featureFlags.cxsWithEpicEnabled, cxId);
  }
  if (demoAugEnabled === true) {
    enableFeatureFlagForCustomer(featureFlags.cxsWithDemoAugEnabled, cxId);
  } else if (demoAugEnabled === false) {
    disableFeatureFlagForCustomer(featureFlags.cxsWithDemoAugEnabled, cxId);
  }
  deduplicateFeatureFlagValues(featureFlags.cxsWithCWFeatureFlag);
  deduplicateFeatureFlagValues(featureFlags.cxsWithCQDirectFeatureFlag);
  deduplicateFeatureFlagValues(featureFlags.cxsWithEpicEnabled);
  deduplicateFeatureFlagValues(featureFlags.cxsWithDemoAugEnabled);
  const newFeatureFlags = await updateFeatureFlags({
    region,
    tableName: featureFlagsTableName,
    newData: featureFlags,
  });
  const currentCwEnabled = newFeatureFlags.cxsWithCWFeatureFlag.values.includes(cxId);
  const currentCqEnabled = newFeatureFlags.cxsWithCQDirectFeatureFlag.values.includes(cxId);
  const currentEpicEnabled = newFeatureFlags.cxsWithEpicEnabled.values.includes(cxId);
  const currentDemoAugEnabled = newFeatureFlags.cxsWithDemoAugEnabled.values.includes(cxId);
  const { log } = out(`Customer ${cxId}`);
  log(
    `New HIE enabled state: ` +
      `CW: ${currentCwEnabled} ` +
      `CQ: ${currentCqEnabled} ` +
      `Epic: ${currentEpicEnabled} ` +
      `Demo Aug: ${currentDemoAugEnabled}`
  );
  return {
    cxsWithCWFeatureFlag: {
      cxInFFValues: currentCwEnabled,
      ffEnabled: newFeatureFlags.cxsWithCWFeatureFlag.enabled,
    },
    cxsWithCQDirectFeatureFlag: {
      cxInFFValues: currentCqEnabled,
      ffEnabled: newFeatureFlags.cxsWithCQDirectFeatureFlag.enabled,
    },
    cxsWithEpicEnabled: {
      cxInFFValues: currentEpicEnabled,
      ffEnabled: newFeatureFlags.cxsWithEpicEnabled.enabled,
    },
    cxsWithDemoAugEnabled: {
      cxInFFValues: currentDemoAugEnabled,
      ffEnabled: newFeatureFlags.cxsWithDemoAugEnabled.enabled,
    },
  };
}
