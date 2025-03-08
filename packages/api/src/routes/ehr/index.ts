import Router from "express-promise-router";
import { checkMAPIAccess } from "../middlewares/auth";
import { processCxIdDash as processCxIdDashAthena } from "./athenahealth/auth/middleware";
import athenaDash from "./athenahealth/dash-router";
import {
  processCxIdDash as processCxIdCanvasDash,
  processCxIdWebhooks as processCxIdCanvasWebhooks,
} from "./canvas/auth/middleware";
import canvasDash from "./canvas/dash-router";
import canvasWebhooks from "./canvas/webhook-router";
import { processCxIdWebhooks as processCxIdElationWebhooks } from "./elation/auth/middleware";
import elationWebhooks from "./elation/webhook-router";

const routes = Router();

routes.use("/athenahealth", processCxIdDashAthena, checkMAPIAccess, athenaDash);
routes.use("/canvas", processCxIdCanvasDash, checkMAPIAccess, canvasDash);

routes.use("/webhook/elation", processCxIdElationWebhooks, checkMAPIAccess, elationWebhooks);
routes.use("/webhook/canvas", processCxIdCanvasWebhooks, checkMAPIAccess, canvasWebhooks);

export default routes;
