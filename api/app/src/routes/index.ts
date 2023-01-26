import { Application } from "express";
import connect from "./connect";
import { processAPIKey } from "./middlewares/auth";
// import  } from "./middlewares/usage";
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
  app.use("/activity", processAPIKey, activity);
  app.use("/body", processAPIKey, body);
  app.use("/biometrics", processAPIKey, biometrics);
  app.use("/nutrition", processAPIKey, nutrition);
  app.use("/sleep", processAPIKey, sleep);
  app.use("/user", processAPIKey, user);

  // routes with session token auth
  app.use("/connect", connect);
};
