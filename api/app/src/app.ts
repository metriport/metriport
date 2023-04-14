import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import * as Sentry from "@sentry/node";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import helmet from "helmet";
import { errorHandler } from "./default-error-handler";
import initDB from "./models/db";
import mountRoutes from "./routes/index";
import { initSentry, isSentryEnabled } from "./sentry";
import { Config } from "./shared/config";

const app: Application = express();
const version = Config.getVersion();

// Must be before routes
initSentry(app);

app.use(helmet()); // needs to come before any route declaration, including cors()
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));
app.use(cors());
app.set("etag", false);

app.use((req, res, next) => {
  version && res.setHeader("x-metriport-version", version);
  next();
});

mountRoutes(app);
module.exports = app;

// route used for health checks
app.get("/", (req: Request, res: Response) => {
  res.status(200).send("OK");
});

// The Sentry error handler must be before any other error middleware and after all controllers
if (isSentryEnabled()) {
  app.use(
    Sentry.Handlers.errorHandler({
      //eslint-disable-next-line @typescript-eslint/no-unused-vars
      shouldHandleError: (error): boolean => {
        // here we can dd logic to decide if we want to send the error to Sentry, like filtering out 404s
        return true;
      },
    })
  );
}
app.use(errorHandler);

const port = 8080;
app.listen(port, "0.0.0.0", async () => {
  // initialize connection to the databases
  await initDB();
  console.log(`[server]: API server is running on port ${port} :)`);
});
