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
      // if (!isTracingEnabledForTx(tx)) return 0;
      const txName = tx.name;
      // Sample some OPTIONS for visibility
      if (txName.match(/^OPTIONS.*$/)) return 0.001;
      return 0.05;
    },
  });
}

// function isTracingEnabledForTx(tx: TransactionContext): boolean {
//   const txName = tx.name;

//   // Do not send health checks to Sentry
//   if (txName === "GET /") return false;

//   // Do not trace responses from IHE GW endpoints
//   if (txName.startsWith("POST /internal/carequality") && txName.includes("response")) return false;

//   return true;
// }
