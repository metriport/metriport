import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import * as Sentry from "@sentry/node";
import cors from "cors";
import express, { Application, Request, Response, Router } from "express";
import helmet from "helmet";
import { nanoid } from "nanoid";
import { errorHandler } from "./default-error-handler";
import BadRequestError from "./errors/bad-request";
import { convertCDAToFHIR } from "./external/fhir-converter/converter";
import initDB from "./models/db";
import mountRoutes from "./routes/index";
import { asyncHandler, getFrom } from "./routes/util";
import { initSentry, isSentryEnabled } from "./sentry";
import { Config } from "./shared/config";

const app: Application = express();
const version = Config.getVersion();

// Must be before routes
initSentry(app);

app.use(helmet()); // needs to come before any route declaration, including cors()

// TODO 706 Remove before merging the PR
// TODO 706 Remove before merging the PR
// TODO 706 Remove before merging the PR
// TODO 706 Remove before merging the PR
app.use(express.text({ limit: "5mb" }));
app.use(
  Router().post(
    "/internal/fhir/convert-to-fhir",
    asyncHandler(async (req: Request, res: Response) => {
      const cxId = getFrom("query").optional("pcxId", req) ?? nanoid();
      const patientId = getFrom("query").optional("patientId", req) ?? nanoid();
      const payload = req.body;
      const s3FileName = payload.s3FileName;
      const s3BucketName = payload.s3BucketName;
      if (!s3FileName || !s3BucketName)
        throw new BadRequestError("Missing s3FileName or s3BucketName");

      try {
        await convertCDAToFHIR({ cxId, patientId, s3FileName, s3BucketName });
      } catch (err) {
        console.log(`Error converting CDA to FHIR: ${err}`);
        return res.sendStatus(500);
      }

      return res.sendStatus(200);
    })
  )
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));
app.use(cors());
app.set("etag", false);

app.use((_req, res, next) => {
  version && res.setHeader("x-metriport-version", version);
  next();
});

mountRoutes(app);
module.exports = app;

// route used for health checks
app.get("/", (_req: Request, res: Response) => {
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
