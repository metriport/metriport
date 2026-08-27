import {
  getFeatureFlags,
  updateFeatureFlags,
} from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { CxFeatureFlagStatus, StringValuesFF } from "@metriport/core/command/feature-flags/types";
import { out } from "@metriport/core/util/log";

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
  ehexEnabled,
  epicEnabled,
  demoAugEnabled,
  adtRosterUploadStatus,
  adtDataVisibleStatus,
}: {
  cxId: string;
  cwEnabled?: boolean;
  cqEnabled?: boolean;
  ehexEnabled?: boolean;
  epicEnabled?: boolean;
  demoAugEnabled?: boolean;
  adtRosterUploadStatus?: boolean;
  adtDataVisibleStatus?: boolean;
}): Promise<CxFeatureFlagStatus> {
  const featureFlags = await getFeatureFlags();
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
  if (ehexEnabled === true) {
    enableFeatureFlagForCustomer(featureFlags.cxsWithEhexEnabled, cxId);
  } else if (ehexEnabled === false) {
    disableFeatureFlagForCustomer(featureFlags.cxsWithEhexEnabled, cxId);
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
  if (adtRosterUploadStatus === true) {
    enableFeatureFlagForCustomer(featureFlags.cxsWithAdtsRosterUploadEnabledFeatureFlag, cxId);
  } else if (adtRosterUploadStatus === false) {
    disableFeatureFlagForCustomer(featureFlags.cxsWithAdtsRosterUploadEnabledFeatureFlag, cxId);
  }
  if (adtDataVisibleStatus === true) {
    enableFeatureFlagForCustomer(featureFlags.cxsWithAdtsDataVisibleEnabledFeatureFlag, cxId);
  } else if (adtDataVisibleStatus === false) {
    disableFeatureFlagForCustomer(featureFlags.cxsWithAdtsDataVisibleEnabledFeatureFlag, cxId);
  }
  deduplicateFeatureFlagValues(featureFlags.cxsWithCWFeatureFlag);
  deduplicateFeatureFlagValues(featureFlags.cxsWithCQDirectFeatureFlag);
  deduplicateFeatureFlagValues(featureFlags.cxsWithEhexEnabled);
  deduplicateFeatureFlagValues(featureFlags.cxsWithEpicEnabled);
  deduplicateFeatureFlagValues(featureFlags.cxsWithDemoAugEnabled);
  deduplicateFeatureFlagValues(featureFlags.cxsWithAdtsRosterUploadEnabledFeatureFlag);
  deduplicateFeatureFlagValues(featureFlags.cxsWithAdtsDataVisibleEnabledFeatureFlag);
  const newFeatureFlags = await updateFeatureFlags({ newData: featureFlags });
  const currentCwEnabled = newFeatureFlags.cxsWithCWFeatureFlag.values.includes(cxId);
  const currentCqEnabled = newFeatureFlags.cxsWithCQDirectFeatureFlag.values.includes(cxId);
  const currentEhexEnabled = newFeatureFlags.cxsWithEhexEnabled.values.includes(cxId);
  const currentEpicEnabled = newFeatureFlags.cxsWithEpicEnabled.values.includes(cxId);
  const currentDemoAugEnabled = newFeatureFlags.cxsWithDemoAugEnabled.values.includes(cxId);
  const currentAdtRosterUploadEnabled =
    newFeatureFlags.cxsWithAdtsRosterUploadEnabledFeatureFlag.values.includes(cxId);
  const currentAdtDataVisibleEnabled =
    newFeatureFlags.cxsWithAdtsDataVisibleEnabledFeatureFlag.values.includes(cxId);
  const { log } = out(`Customer ${cxId}`);
  log(
    `New HIE enabled state: ` +
      `CW: ${currentCwEnabled} ` +
      `CQ: ${currentCqEnabled} ` +
      `EHEX: ${currentEhexEnabled} ` +
      `Epic: ${currentEpicEnabled} ` +
      `Demo Aug: ${currentDemoAugEnabled} ` +
      `ADT Roster Upload: ${currentAdtRosterUploadEnabled} ` +
      `ADT Data Visible: ${currentAdtDataVisibleEnabled}`
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
    cxsWithEhexEnabled: {
      cxInFFValues: currentEhexEnabled,
      ffEnabled: newFeatureFlags.cxsWithEhexEnabled.enabled,
    },
    cxsWithEpicEnabled: {
      cxInFFValues: currentEpicEnabled,
      ffEnabled: newFeatureFlags.cxsWithEpicEnabled.enabled,
    },
    cxsWithDemoAugEnabled: {
      cxInFFValues: currentDemoAugEnabled,
      ffEnabled: newFeatureFlags.cxsWithDemoAugEnabled.enabled,
    },
    cxsWithAdtsRosterUploadEnabledFeatureFlag: {
      cxInFFValues: currentAdtRosterUploadEnabled,
      ffEnabled: newFeatureFlags.cxsWithAdtsRosterUploadEnabledFeatureFlag.enabled,
    },
    cxsWithAdtsDataVisibleEnabledFeatureFlag: {
      cxInFFValues: currentAdtDataVisibleEnabled,
      ffEnabled: newFeatureFlags.cxsWithAdtsDataVisibleEnabledFeatureFlag.enabled,
    },
  };
}
