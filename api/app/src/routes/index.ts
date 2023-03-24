import { Application } from "express";

import activity from "./activity";
import biometrics from "./biometrics";
import body from "./body";
import connect from "./connect";
import { requestLogger } from "./helpers/requestLogger";
import { checkMAPIAccess, processAPIKey } from "./middlewares/auth";
import { reportDeviceUsage, reportMedicalUsage } from "./middlewares/usage";
import { analyzeDevicesRoutes, analyzeMedicalRoutes } from "./middlewares/analytics";
import nutrition from "./nutrition";
import oauthRoutes from "./oauth-routes";
import settings from "./settings";
import sleep from "./sleep";
import user from "./user";
import webhook from "./webhook";
import medical from "./medical";

export default (app: Application) => {
  app.use(requestLogger);

  // internal only routes, should be disabled at API Gateway
  app.use("/webhook", webhook);

  // routes with API key auth
  app.use("/settings", processAPIKey, settings);
  app.use("/activity", processAPIKey, reportDeviceUsage, analyzeDevicesRoutes, activity);
  app.use("/body", processAPIKey, reportDeviceUsage, analyzeDevicesRoutes, body);
  app.use("/biometrics", processAPIKey, reportDeviceUsage, analyzeDevicesRoutes, biometrics);
  app.use("/nutrition", processAPIKey, reportDeviceUsage, analyzeDevicesRoutes, nutrition);
  app.use("/sleep", processAPIKey, reportDeviceUsage, analyzeDevicesRoutes, sleep);
  app.use("/user", processAPIKey, reportDeviceUsage, analyzeDevicesRoutes, user);

  // medical routes with API key auth
  app.use(
    "/medical/v1",
    processAPIKey,
    checkMAPIAccess,
    reportMedicalUsage,
    analyzeMedicalRoutes,
    medical
  );

  // routes with session token auth
  app.use("/connect", connect);

  // routes with OAuth based authentication
  app.use("/oauth", oauthRoutes);
};
