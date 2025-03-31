import {
  getCxsWithFeatureFlagEnabled,
  isFeatureFlagEnabled,
} from "@metriport/core/command/feature-flags/domain-ffs";
import { getFeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { Config as ConfigCore } from "@metriport/core/util/config";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { getEnvVar } from "@metriport/shared";
import { getCxIdFromApiKey } from "../../routes/middlewares/auth";
import { Config } from "../../shared/config";
import { initializeFeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";

const { log } = out(`App Config - FF`);

/**
 * Go through all Feature Flags to make sure they are accessible.
 */
export async function initFeatureFlags({
  region = Config.getAWSRegion(),
  tableName = ConfigCore.getFeatureFlagsTableName(),
}: {
  region?: string;
  tableName?: string;
} = {}) {
  initializeFeatureFlags({ region, tableName });
  try {
    await getFeatureFlags();
  } catch (error) {
    throw new MetriportError(`Failed to initialize Feature Flags`, error);
  }
  log(`Feature Flags initialized.`);
}

// TODO move these to core's packages/core/src/command/feature-flags/index.ts

export async function getCxsWithEnhancedCoverageFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithEnhancedCoverageFeatureFlag");
}

export async function getCxsWithCQDirectFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithCQDirectFeatureFlag");
}

export async function getCxsWithCWFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithCWFeatureFlag");
}

export async function getCxsWithIncreasedSandboxLimitFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithIncreasedSandboxLimitFeatureFlag");
}

export async function getCxsWithNoWebhookPongFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithNoWebhookPongFeatureFlag");
}

export async function getCxsWithEpicEnabled(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithEpicEnabled");
}

export async function getCxsWithAiBriefFeatureFlag(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithAiBriefFeatureFlag");
}

export async function getCxsWithCdaCustodianFeatureFlag(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("getCxsWithCdaCustodianFeatureFlag");
}

export async function getCxsWitDemoAugEnabled(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithDemoAugEnabled");
}

export async function getCxsWitStalePatientUpdateEnabled(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithStalePatientUpdateEnabled");
}

export async function getE2eCxIds(): Promise<string | undefined> {
  if (Config.isDev()) {
    const apiKey = getEnvVar("TEST_API_KEY");
    return apiKey ? getCxIdFromApiKey(apiKey) : undefined;
  }
  const cxIds = await getCxsWithFeatureFlagEnabled("e2eCxIds");
  if (cxIds.length > 1) {
    const msg = `FF e2eCxIds should have 1 cxId`;
    log(`${msg} but it has ${cxIds.length}, using the first one.`);
    capture.message(msg, { extra: { cxIds }, level: "warning" });
  }
  return cxIds[0];
}

export async function isE2eCx(cxId: string): Promise<boolean> {
  const e2eCxId = await getE2eCxIds();
  return e2eCxId === cxId;
}

export async function isEnhancedCoverageEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithECEnabled = await getCxsWithEnhancedCoverageFeatureFlagValue();
  return cxIdsWithECEnabled.some(i => i === cxId);
}

export async function isCQDirectEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithCQDirectEnabled = await getCxsWithCQDirectFeatureFlagValue();
  return cxIdsWithCQDirectEnabled.some(i => i === cxId);
}

export async function isCWEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithCWDirectEnabled = await getCxsWithCWFeatureFlagValue();
  return cxIdsWithCWDirectEnabled.some(i => i === cxId);
}

export async function isWebhookPongDisabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithNoWebhookPong = await getCxsWithNoWebhookPongFeatureFlagValue();
  return cxIdsWithNoWebhookPong.some(i => i === cxId);
}

export async function isCdaCustodianEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithFhirDedupEnabled = await getCxsWithCdaCustodianFeatureFlag();
  return cxIdsWithFhirDedupEnabled.some(i => i === cxId);
}

export async function isEpicEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithEpicEnabled = await getCxsWithEpicEnabled();
  return cxIdsWithEpicEnabled.some(i => i === cxId);
}

export async function isDemoAugEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithDemoAugEnabled = await getCxsWitDemoAugEnabled();
  return cxIdsWithDemoAugEnabled.some(i => i === cxId);
}

export async function isStalePatientUpdateEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithStalePatientUpdateEnabled = await getCxsWitStalePatientUpdateEnabled();
  return cxIdsWithStalePatientUpdateEnabled.some(i => i === cxId);
}

export async function isCommonwellEnabled(): Promise<boolean> {
  return isFeatureFlagEnabled("commonwellFeatureFlag");
}

export async function isCarequalityEnabled(): Promise<boolean> {
  return isFeatureFlagEnabled("carequalityFeatureFlag");
}
