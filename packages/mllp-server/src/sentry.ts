import * as Sentry from "@sentry/node";
import { Config } from "./config";

export function isSentryEnabled() {
  return Boolean(Config.getSentryDSN());
}

export function initSentry(): void {
  Sentry.init({
    enabled: isSentryEnabled(),
    dsn: Config.getSentryDSN(),
    environment: Config.getEnvType(),
    release: Config.getVersion(),
    integrations: [],
    sampleRate: 1.0,
    tracesSampler: tx => {
      const txName = tx.name;
      // Sample some OPTIONS for visibility
      if (txName.match(/^OPTIONS.*$/)) return 0.001;
      return 0.05;
    },
  });
}
