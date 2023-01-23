import { Application } from "express";
import connect from "./connect";
import { processAPIKey } from "./middlewares/auth";
import { reportUsage } from "./middlewares/usage";
import nutrition from "./nutrition";
import activity from "./activity";
import body from "./body";
import biometrics from "./biometrics";
import sleep from "./sleep";
import user from "./user";
import settings from "./settings";
import { requestLogger } from "./helpers/requestLogger";
import webhook from "./webhook";

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

  // routes with session token auth
  app.use("/connect", connect);
};
