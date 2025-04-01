import { getCxsWithFeatureFlagEnabled } from "@metriport/core/command/feature-flags/domain-ffs";
import { getFeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { Config as ConfigCore } from "@metriport/core/util/config";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { getEnvVar } from "@metriport/shared";
import { getCxIdFromApiKey } from "../../routes/middlewares/auth";
import { Config } from "../../shared/config";

const { log } = out(`App Config - FF`);

/**
 * Go through all Feature Flags to make sure they are accessible.
 */
export async function initFeatureFlags() {
  if (Config.isDev()) {
    log(`Skipping initializing Feature Flags - Develop/Local env`);
    return;
  }
  try {
    await getFeatureFlags(Config.getAWSRegion(), ConfigCore.getFeatureFlagsTableName());
  } catch (error) {
    throw new MetriportError(`Failed to initialize Feature Flags`, error);
  }
  log(`Feature Flags initialized.`);
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
