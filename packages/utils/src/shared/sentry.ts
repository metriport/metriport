import { getEnvType, getEnvVar } from "@metriport/shared";
import * as Sentry from "@sentry/node";

const sentryDsn = getEnvVar("SENTRY_DSN");

/**
 * Function to initialize Sentry for rare cases we want to test sending events to Sentry.
 *
 * Note: this should only be called while developing, don't push code to the repo enabling
 * Sentry in scripts that might send lots of messages to Sentry.
 *
 * @see packages/api/src/sentry.ts
 * @see packages/lambdas/src/shared/capture.ts
 */
export function initSentry() {
  Sentry.init({
    dsn: sentryDsn,
    enabled: sentryDsn != null,
    environment: getEnvType(),
    sampleRate: 1.0, // error sample rate
    tracesSampleRate: 0, // transaction sample rate
  });
}
