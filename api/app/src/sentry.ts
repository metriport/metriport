import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";
import { Application } from "express";
import { Config } from "./shared/config";

export const isSentryEnabled = () => Config.isCloudEnv() && Boolean(Config.getSentryDSN());

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
    sampleRate: 1.0, // TODO: #156 Add a ticket to review this periodically
    // Traces sample rate
    tracesSampler: samplingContext => {
      // Do not send health checks to Sentry
      if (samplingContext.transactionContext.name === "GET /") {
        return 0;
      }
      // Sample 1% of OPTIONS to have some visibility
      if (samplingContext.transactionContext.name.match(/^OPTIONS.*$/)) {
        return 0.01;
      }
      // TODO: #156 Add a ticket to review this periodically
      return 0.5;
    },
  });
  if (isSentryEnabled()) {
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
  }
}
