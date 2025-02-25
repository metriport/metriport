import Router from "express-promise-router";
import { checkMAPIAccess } from "../middlewares/auth";
import { processCxId as processCxIdOauthAthena } from "./athenahealth/auth/middleware";
import athenaOAuth from "./athenahealth/oauth-router";
import {
  processCxIdOauth as processCxIdCanvasOAuth,
  processCxIdWebhooks as processCxIdCanvasWebhooks,
} from "./canvas/auth/middleware";
import canvasOAuth from "./canvas/oauth-router";
import canvasWebhooks from "./canvas/webhook-router";

const routes = Router();

routes.use("/athenahealth", processCxIdOauthAthena, checkMAPIAccess, athenaOAuth);
routes.use("/canvas", processCxIdCanvasOAuth, checkMAPIAccess, canvasOAuth);

routes.use("/webhook/canvas", processCxIdCanvasWebhooks, checkMAPIAccess, canvasWebhooks);

export default routes;
