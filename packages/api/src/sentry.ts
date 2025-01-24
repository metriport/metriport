import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";
import { TransactionContext } from "@sentry/types";
import { Application } from "express";
import { Config } from "./shared/config";

export const isSentryEnabled = () => Boolean(Config.getSentryDSN());

export function initSentry(app: Application): void {
  Sentry.init({
    enabled: isSentryEnabled(),
    dsn: Config.getSentryDSN(),
    environment: Config.getEnvType(),
    release: Config.getVersion(),
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Tracing.Integrations.Express({ app }),
    ],
    // https://docs.sentry.io/platforms/node/guides/express/configuration/sampling
    // Error sample rate - 0.0 to 1.0
    sampleRate: 1.0,
    // Traces sample rate
    tracesSampler: samplingContext => {
      const tx = samplingContext.transactionContext;
      if (isTracingDisabledForTx(tx)) return 0;
      const txName = tx.name;
      // Sample some OPTIONS for visibility
      if (txName.match(/^OPTIONS.*$/)) return 0.001;
      return 0.05;
    },
  });
  if (isSentryEnabled()) {
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
  }
}

function isTracingDisabledForTx(tx: TransactionContext): boolean {
  const txName = tx.name;

  // Do not send health checks to Sentry
  if (txName === "GET /") return true;

  // Do not trace responses from IHE GW endpoints
  if (txName.startsWith("POST /internal/carequality") && txName.includes("response")) return true;

  return false;
}
