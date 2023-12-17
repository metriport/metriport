import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else.
import { sleep } from "@metriport/shared";
import * as Sentry from "@sentry/node";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import helmet from "helmet";
import initDB from "./models/db";
import { errorHandler } from "./routes/helpers/default-error-handler";
import mountRoutes from "./routes/index";
import { initSentry, isSentryEnabled } from "./sentry";
import { Config } from "./shared/config";
import { isClientError } from "./shared/http";
import { capture } from "@metriport/core/util/notifications";

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
  version && res.setHeader("x-metriport-version", version);
  next();
});

mountRoutes(app);
module.exports = app;

// route used for health checks
app.get("/", (req: Request, res: Response) => {
  if (req.accepts("application/json")) return res.json({ status: "OK" });
  return res.status(200).send("OK");
});

// The Sentry error handler must be before any other error middleware and after all controllers
if (isSentryEnabled()) {
  app.use(
    Sentry.Handlers.errorHandler({
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      shouldHandleError: (error: any): boolean => {
        // here we can dd logic to decide if we want to send the error to Sentry, like filtering out 404s
        if (isClientError(error)) return false;
        return true;
      },
    })
  );
}
app.use(errorHandler);

const port = 8080;
app.listen(port, "0.0.0.0", async () => {
  try {
    // initialize connection to the databases
    await initDB();
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
