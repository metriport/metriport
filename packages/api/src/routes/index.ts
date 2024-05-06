import { Application } from "express";
import activity from "./activity";
import biometrics from "./biometrics";
import body from "./body";
import connect from "./connect";
import { reportClientErrors } from "./helpers/report-client-errors";
import internal from "./internal";
import medical from "./medical";
import fhirRouter from "./medical/fhir-r4-proxy";
import { checkMAPIAccess, processAPIKey } from "./middlewares/auth";
import { reportDeviceUsage } from "./middlewares/usage";
import nutrition from "./nutrition";
import oauthRoutes from "./oauth-routes";
import settings from "./settings";
import sleep from "./sleep";
import user from "./user";
import webhook from "./webhook";

export default (app: Application) => {
  // internal only routes, should be disabled at API Gateway
  app.use("/webhook", reportClientErrors, webhook);
  app.use("/internal", internal);

  // routes with API key auth
  app.use("/settings", processAPIKey, settings);
  app.use("/activity", processAPIKey, reportDeviceUsage, activity);
  app.use("/body", processAPIKey, reportDeviceUsage, body);
  app.use("/biometrics", processAPIKey, reportDeviceUsage, biometrics);
  app.use("/nutrition", processAPIKey, reportDeviceUsage, nutrition);
  app.use("/sleep", processAPIKey, reportDeviceUsage, sleep);
  app.use("/user", processAPIKey, reportDeviceUsage, user);

  // medical routes with API key auth - report usage is on individual routes
  app.use("/medical/v1", processAPIKey, checkMAPIAccess, medical);
  app.use("/fhir/R4", processAPIKey, checkMAPIAccess, fhirRouter);

  // routes with session token auth
  app.use("/connect", connect);

  // routes with OAuth based authentication
  app.use("/oauth", reportClientErrors, oauthRoutes);
};
