import { Application } from "express";
import activity from "./activity";
import biometrics from "./biometrics";
import body from "./body";
import connect from "./connect";
import ehr from "./ehr";
import feedback from "./feedback";
import { reportClientErrors } from "./helpers/report-client-errors";
import internal from "./internal";
import medical from "./medical";
import fhirRouter from "./medical/fhir-r4-proxy";
import { checkMAPIAccess, processCxId } from "./middlewares/auth";
import { reportDeviceUsage } from "./middlewares/usage";
import nutrition from "./nutrition";
import oauthRoutes from "./oauth-routes";
import settings from "./settings";
import sleep from "./sleep";
import user from "./user";
import webhook from "./webhook";

// Supports requests from the Dashboard through the dedicated JWT-based auth on API GW
const dash = "/dash-oss";

export default (app: Application) => {
  // internal only routes, should be disabled at API Gateway
  app.use("/webhook", reportClientErrors, webhook);
  app.use("/internal", internal);

  // routes with API key auth
  app.use("/settings", processCxId, settings);
  app.use(`${dash}/settings`, processCxId, settings);
  app.use("/activity", processCxId, reportDeviceUsage, activity);
  app.use("/body", processCxId, reportDeviceUsage, body);
  app.use("/biometrics", processCxId, reportDeviceUsage, biometrics);
  app.use("/nutrition", processCxId, reportDeviceUsage, nutrition);
  app.use("/sleep", processCxId, reportDeviceUsage, sleep);
  app.use("/user", processCxId, reportDeviceUsage, user);

  // medical routes with API key auth - report usage is on individual routes
  app.use("/medical/v1", processCxId, checkMAPIAccess, medical);
  app.use(`${dash}/medical/v1`, processCxId, checkMAPIAccess, medical);
  app.use("/fhir/R4", processCxId, checkMAPIAccess, fhirRouter);

  // routes with API key auth - validated on the API Gateway
  app.use(`/feedback`, feedback);

  // routes with session token auth
  app.use("/connect", connect);

  // routes with OAuth based authentication
  app.use("/oauth", reportClientErrors, oauthRoutes);

  // routes with JWT based authentication
  app.use("/ehr", ehr);
};
