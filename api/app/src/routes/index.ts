import { Application, Request, Response } from "express";
import { nanoid } from "nanoid";
import { capture } from "../shared/notifications";
import activity from "./activity";
import biometrics from "./biometrics";
import body from "./body";
import connect from "./connect";
import { requestLogger } from "./helpers/requestLogger";
import internal from "./internal";
import medical from "./medical";
import { checkMAPIAccess, processAPIKey } from "./middlewares/auth";
import { reportDeviceUsage, reportMedicalUsage } from "./middlewares/usage";
import nutrition from "./nutrition";
import oauthRoutes from "./oauth-routes";
import settings from "./settings";
import sleep from "./sleep";
import user from "./user";
import { asyncHandler, getCxId } from "./util";
import webhook from "./webhook";

export default (app: Application) => {
  app.use(requestLogger);

  // internal only routes, should be disabled at API Gateway
  app.use("/webhook", webhook);
  app.use("/internal", internal);

  // routes with API key auth
  app.use("/settings", processAPIKey, settings);
  app.use("/activity", processAPIKey, reportDeviceUsage, activity);
  app.use("/body", processAPIKey, reportDeviceUsage, body);
  app.use("/biometrics", processAPIKey, reportDeviceUsage, biometrics);
  app.use("/nutrition", processAPIKey, reportDeviceUsage, nutrition);
  app.use("/sleep", processAPIKey, reportDeviceUsage, sleep);
  app.use("/user", processAPIKey, reportDeviceUsage, user);

  // medical routes with API key auth
  app.use("/medical/v1", processAPIKey, checkMAPIAccess, reportMedicalUsage, medical);

  // routes with session token auth
  app.use("/connect", connect);

  // routes with OAuth based authentication
  app.use("/oauth", oauthRoutes);

  // TODO #156 remove this
  app.get(
    "/error",
    processAPIKey,
    asyncHandler(async (req: Request) => {
      getCxId(req);
      try {
        throw new Error("This is an error");
      } catch (err) {
        capture.error(err, {
          user: { id: nanoid() },
          extra: { userName: "Some Fake Name" },
        });
        throw err;
      }
    })
  );
  app.get(
    "/message",
    processAPIKey,
    asyncHandler(async (req: Request, res: Response) => {
      getCxId(req);
      capture.message("Something special happened now", {
        extra: { userName: "Some Fake Name" },
      });
      return res.sendStatus(204);
    })
  );
};
