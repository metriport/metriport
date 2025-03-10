import { Config as CoreConfig } from "@metriport/core/util/config";
import { getEnvVar } from "@metriport/shared/common/env-var";

export class Config extends CoreConfig {
  static getSentryDSN(): string | undefined {
    return getEnvVar("SENTRY_DSN");
  }
  static getVersion(): string | undefined {
    return getEnvVar("RELEASE_SHA");
  }
}
