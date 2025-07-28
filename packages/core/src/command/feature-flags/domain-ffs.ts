import { errorToString } from "@metriport/shared";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { getFeatureFlags } from "./ffs-on-dynamodb";
import {
  BooleanFeatureFlags,
  CxFeatureFlagStatus,
  StringValueFeatureFlags,
  stringValueFFsSchema,
} from "./types";

const { log } = out(`FFs`);

export async function getFeatureFlagValueCxValues<T extends keyof StringValueFeatureFlags>(
  cxId: string,
  featureFlagNames?: T[]
): Promise<CxFeatureFlagStatus> {
  const configContentValue = await getFeatureFlags();
  const targetFeatureFlags =
    featureFlagNames && featureFlagNames.length > 0
      ? featureFlagNames
      : stringValueFFsSchema.keyof().options;
  let response: CxFeatureFlagStatus = {};
  targetFeatureFlags.map(featureFlagName => {
    const featureFlag = configContentValue[featureFlagName];
    if (featureFlag) {
      response = {
        ...response,
        [featureFlagName]: {
          cxInFFValues: featureFlag.values.includes(cxId),
          ffEnabled: featureFlag.enabled,
        },
      };
    }
  });
  return response;
}

export async function getFeatureFlagValueStringArray<T extends keyof StringValueFeatureFlags>(
  featureFlagName: T
): Promise<StringValueFeatureFlags[T]> {
  try {
    const configContentValue = await getFeatureFlags();
    return configContentValue[featureFlagName];
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName };
    log(`${msg} - ${JSON.stringify(extra)} - ${errorToString(error)}`);
    capture.error(msg, { extra: { ...extra, error } });
    return { enabled: false, values: [] };
  }
}

export async function getFeatureFlagValueBoolean<T extends keyof BooleanFeatureFlags>(
  featureFlagName: T
): Promise<BooleanFeatureFlags[T]> {
  const configContentValue = await getFeatureFlags();
  return configContentValue[featureFlagName];
}

/**
 * Checks whether the specified feature flag is enabled.
 *
 * @returns true if enabled; false otherwise
 */
export async function isFeatureFlagEnabled(
  featureFlagName: keyof BooleanFeatureFlags,
  defaultValue = false
): Promise<boolean> {
  try {
    const featureFlag = await getFeatureFlagValueBoolean(featureFlagName);
    return featureFlag ? featureFlag.enabled : defaultValue;
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName };
    log(`${msg} - ${JSON.stringify(extra)} - ${errorToString(error)}`);
    capture.error(msg, { extra: { ...extra, error } });
  }
  return defaultValue;
}

/**
 * Returns the list of customers that are enabled for the given feature flag.
 *
 * @returns Array of string values
 */
export async function getCxsWithFeatureFlagEnabled(
  featureFlagName: keyof StringValueFeatureFlags
): Promise<string[]> {
  try {
    const featureFlag = await getFeatureFlagValueStringArray(featureFlagName);
    if (featureFlag && featureFlag.enabled) {
      return featureFlag.values;
    }
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName };
    log(`${msg} - ${JSON.stringify(extra)} - ${errorToString(error)}`);
    capture.error(msg, { extra: { ...extra, error } });
  }
  return [];
}

export async function isCommonwellEnabled(): Promise<boolean> {
  return isFeatureFlagEnabled("commonwellFeatureFlag");
}

export async function isCarequalityEnabled(): Promise<boolean> {
  return isFeatureFlagEnabled("carequalityFeatureFlag");
}

export async function getCxsWithAiBriefFeatureFlag(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithAiBriefFeatureFlag");
}
export async function isAiBriefFeatureFlagEnabledForCx(cxId: string): Promise<boolean> {
  const cxsWithFeatureFlagValue = await getCxsWithAiBriefFeatureFlag();
  return cxsWithFeatureFlagValue.includes(cxId);
}

export async function getCxsWithStrictMatchingAlgorithm(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithStrictMatchingAlgorithm");
}
export async function isStrictMatchingAlgorithmEnabledForCx(cxId: string): Promise<boolean> {
  const cxsWithStrictMatchingAlgorithmEnabled = await getCxsWithStrictMatchingAlgorithm();
  return cxsWithStrictMatchingAlgorithmEnabled.includes(cxId);
}

export async function getCxsWithAthenaCustomFieldsEnabled(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithAthenaCustomFieldsEnabled");
}
export async function isAthenaCustomFieldsEnabledForCx(cxId: string): Promise<boolean> {
  const cxsWithAthenaCustomFieldsEnabled = await getCxsWithAthenaCustomFieldsEnabled();
  return cxsWithAthenaCustomFieldsEnabled.includes(cxId);
}

export async function getCxsWithEnhancedCoverageFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithEnhancedCoverageFeatureFlag");
}
export async function isEnhancedCoverageEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithECEnabled = await getCxsWithEnhancedCoverageFeatureFlagValue();
  return cxIdsWithECEnabled.some(i => i === cxId);
}

export async function getCxsWithCQDirectFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithCQDirectFeatureFlag");
}
export async function isCQDirectEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithCQDirectEnabled = await getCxsWithCQDirectFeatureFlagValue();
  return cxIdsWithCQDirectEnabled.some(i => i === cxId);
}

export async function getCxsWithCWFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithCWFeatureFlag");
}
export async function isCWEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithCWDirectEnabled = await getCxsWithCWFeatureFlagValue();
  return cxIdsWithCWDirectEnabled.some(i => i === cxId);
}

export async function getCxsWithIncreasedSandboxLimitFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithIncreasedSandboxLimitFeatureFlag");
}

export async function getCxsWithNoWebhookPongFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithNoWebhookPongFeatureFlag");
}
export async function isWebhookPongDisabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithNoWebhookPong = await getCxsWithNoWebhookPongFeatureFlagValue();
  return cxIdsWithNoWebhookPong.some(i => i === cxId);
}

export async function getCxsWithCdaCustodianFeatureFlag(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("getCxsWithCdaCustodianFeatureFlag");
}
export async function isCdaCustodianEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithFhirDedupEnabled = await getCxsWithCdaCustodianFeatureFlag();
  return cxIdsWithFhirDedupEnabled.some(i => i === cxId);
}

export async function getCxsWitDemoAugEnabled(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithDemoAugEnabled");
}
export async function isDemoAugEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithDemoAugEnabled = await getCxsWitDemoAugEnabled();
  return cxIdsWithDemoAugEnabled.some(i => i === cxId);
}

export async function getCxsWitStalePatientUpdateEnabled(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithStalePatientUpdateEnabled");
}
export async function isStalePatientUpdateEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithStalePatientUpdateEnabled = await getCxsWitStalePatientUpdateEnabled();
  return cxIdsWithStalePatientUpdateEnabled.some(i => i === cxId);
}

export async function getCxsWithEpicEnabled(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithEpicEnabled");
}
export async function isEpicEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithEpicEnabled = await getCxsWithEpicEnabled();
  return cxIdsWithEpicEnabled.some(i => i === cxId);
}

export async function getCxsWithADHDFeatureFlag(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithADHDMRFeatureFlag");
}
export async function isADHDFeatureFlagEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithADHDEnabled = await getCxsWithADHDFeatureFlag();
  return cxIdsWithADHDEnabled.some(i => i === cxId);
}

export async function getCxsWithNoMrLogoFeatureFlag(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithNoMrLogoFeatureFlag");
}
export async function isLogoEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithNoMrLogo = await getCxsWithNoMrLogoFeatureFlag();
  return !cxIdsWithNoMrLogo.some(i => i === cxId);
}

export async function getCxsWithBmiFeatureFlag(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithBmiMrFeatureFlag");
}
export async function isBmiFeatureFlagEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithBmiEnabled = await getCxsWithBmiFeatureFlag();
  return cxIdsWithBmiEnabled.some(i => i === cxId);
}

export async function getCxsWithDermFeatureFlag(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithDermMrFeatureFlag");
}
export async function isDermFeatureFlagEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithDermEnabled = await getCxsWithDermFeatureFlag();
  return cxIdsWithDermEnabled.some(i => i === cxId);
}

export async function getCxsWithPcpVisitAiSummaryFeatureFlag(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithPcpVisitAiSummaryFeatureFlag");
}
export async function isPcpVisitAiSummaryFeatureFlagEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithPcpVisitAiSummaryEnabled = await getCxsWithPcpVisitAiSummaryFeatureFlag();
  return cxIdsWithPcpVisitAiSummaryEnabled.some(i => i === cxId);
}

export async function getCxsWithHl7NotificationWebhookFeatureFlag(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithHl7NotificationWebhookFeatureFlag");
}
export async function isHl7NotificationWebhookFeatureFlagEnabledForCx(
  cxId: string
): Promise<boolean> {
  const cxIdsWithHl7NotificationWebhookEnabled =
    await getCxsWithHl7NotificationWebhookFeatureFlag();
  return cxIdsWithHl7NotificationWebhookEnabled.some(i => i === cxId);
}

// ENG-536 remove this once we automatically find the discharge summary
export async function getCxsWithDischargeSlackNotificationFeatureFlag(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithDischargeSlackNotificationFeatureFlag");
}
export async function isDischargeSlackNotificationFeatureFlagEnabledForCx(
  cxId: string
): Promise<boolean> {
  const cxsWithDischargeSlackNotificationFeatureFlag =
    await getCxsWithDischargeSlackNotificationFeatureFlag();
  return cxsWithDischargeSlackNotificationFeatureFlag.some(i => i === cxId);
}

export async function getCxsWithDischargeRequeryFeatureFlag(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithDischargeRequeryFeatureFlag");
}
export async function isDischargeRequeryFeatureFlagEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithDischargeRequeryEnabled = await getCxsWithDischargeRequeryFeatureFlag();
  return cxIdsWithDischargeRequeryEnabled.some(i => i === cxId);
}

export async function getCxsWithXmlRedownloadFeatureFlag(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithXmlRedownloadFeatureFlag");
}
export async function isXmlRedownloadFeatureFlagEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithXmlRedownloadEnabled = await getCxsWithXmlRedownloadFeatureFlag();
  return cxIdsWithXmlRedownloadEnabled.some(i => i === cxId);
}
