import * as Sentry from "@sentry/node";
import { Config } from "./config";

export const isSentryEnabled = () => Boolean(Config.getSentryDSN());

export function initSentry(): void {
  Sentry.init({
    enabled: isSentryEnabled(),
    dsn: Config.getSentryDSN(),
    environment: Config.getEnvType(),
    release: Config.getVersion(),
    integrations: [],
    sampleRate: 1.0,
    tracesSampler: samplingContext => {
      const tx = samplingContext.transactionContext;
      const txName = tx.name;
      // Sample some OPTIONS for visibility
      if (txName.match(/^OPTIONS.*$/)) return 0.001;
      return 0.05;
    },
  });
}
