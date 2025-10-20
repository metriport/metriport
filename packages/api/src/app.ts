import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else.
import { capture } from "@metriport/core/util";
import { sleep } from "@metriport/shared";
import * as Sentry from "@sentry/node";
import cors from "cors";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import express, { Application, Request, Response } from "express";
import helmet from "helmet";
import { initEvents } from "./event";
import { initFeatureFlags } from "./external/feature-flags";
import initDB from "./models/db";
import { VERSION_HEADER_NAME } from "./routes/header";
import { errorHandler, isMetriportError } from "./routes/helpers/default-error-handler";
import { notFoundHandlers } from "./routes/helpers/not-found-handler";
import mountRoutes from "./routes/index";
import { initRateLimiter } from "./routes/middlewares/rate-limiting";
import { initSentry, isSentryEnabled } from "./sentry";
import { Config } from "./shared/config";
import { isClientError } from "./shared/http";
import { isAxiosError } from "axios";

dayjs.extend(duration);

const app: Application = express();
const version = Config.getVersion();

// Must be before routes
initSentry(app);

app.use(helmet()); // needs to come before any route declaration, including cors()
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: false, limit: "20mb" }));
app.use(cors());
app.set("etag", false);

app.use((_req, res, next) => {
  version && res.setHeader(VERSION_HEADER_NAME, version);
  next();
});

mountRoutes(app);
module.exports = app;

// health check route
app.get("/", (req: Request, res: Response) => {
  if (req.accepts("application/json")) return res.json({ status: "OK" });
  return res.status(200).send("OK");
});

// TODO remove this and only have this logic on the default error handler
// The Sentry error handler must be before any other error middleware and after all controllers
if (isSentryEnabled()) {
  app.use(
    Sentry.Handlers.errorHandler({
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      shouldHandleError: (error: any): boolean => {
        // Here we can dd logic to decide if we want to send the error to Sentry, like filtering out 404s
        // The logic is split between here and `default-error-handler` since we need to access the request
        if (isClientError(error)) return false;
        capture.setExtra({
          ...(isMetriportError(error) ? error.additionalInfo : {}),
          ...(isAxiosError(error)
            ? {
                stack: error.stack,
                method: error.config?.method,
                url: error.config?.url,
                data: error.response?.data,
              }
            : {}),
          error,
        });
        return true;
      },
    })
  );
}
app.use(errorHandler);

app.all("*", ...notFoundHandlers);

initEvents();

const port = 8080;
const server = app.listen(port, "0.0.0.0", async () => {
  try {
    // Initialize connection to the database and feature flags
    await Promise.all([initDB(), initFeatureFlags()]);
    // Initialize rate limiter after initDB
    initRateLimiter();
    console.log(`[server]: API server is running on port ${port} :)`);
  } catch (error) {
    const msg = "API server failed to start";
    console.error(msg, error);
    capture.message(msg, { extra: { error }, level: "fatal" });
    // give some time to make sure the previous message is sent to Sentry
    await sleep(200);
    process.exit(1);
  }
});

/**
 * Make sure the server's keep alive is greater than the LB's timeout and the timeout is lower.
 * @see https://github.com/metriport/metriport-internal/issues/1973
 */
const loadbalancerTimeout =
  Config.getLbTimeoutInMillis() ?? dayjs.duration({ minutes: 10 }).asMilliseconds();
const oneSecond = dayjs.duration({ seconds: 1 }).asMilliseconds();

const timeout = loadbalancerTimeout - oneSecond;
server.setTimeout(timeout);

const keepalive = loadbalancerTimeout + oneSecond;
server.keepAliveTimeout = keepalive;
// Just in case: https://github.com/nodejs/node/issues/27363#issuecomment-603489130
server.headersTimeout = keepalive + oneSecond;
