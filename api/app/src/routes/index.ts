import { Application } from "express";
import activity from "./activity";
import biometrics from "./biometrics";
import body from "./body";
import connect from "./connect";
import { requestLogger } from "./helpers/requestLogger";
import { processAPIKey } from "./middlewares/auth";
import { reportUsage } from "./middlewares/usage";
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
  app.use("/activity", processAPIKey, reportUsage, activity);
  app.use("/body", processAPIKey, reportUsage, body);
  app.use("/biometrics", processAPIKey, reportUsage, biometrics);
  app.use("/nutrition", processAPIKey, reportUsage, nutrition);
  app.use("/sleep", processAPIKey, reportUsage, sleep);
  app.use("/user", processAPIKey, reportUsage, user);

  // medical routes with API key auth
  app.use("/medical", processAPIKey, medical);

  // routes with session token auth
  app.use("/connect", connect);

  // routes with OAuth based authentication
  app.use("/oauth", oauthRoutes);
};
