import Router from "express-promise-router";
import { checkMAPIAccess } from "../middlewares/auth";
import { processCxIdDash as processCxIdDashAthena } from "./athenahealth/auth/middleware";
import athenaDash from "./athenahealth/routers/dash-router";
import {
  processCxIdDash as processCxIdCanvasDash,
  processCxIdWebhooks as processCxIdCanvasWebhooks,
} from "./canvas/auth/middleware";
import canvasDash from "./canvas/routers/dash-router";
import canvasWebhooks from "./canvas/routers/webhook-router";
import {
  processCxIdDash as processCxIdElationDash,
  processCxIdWebhooks as processCxIdElationWebhooks,
} from "./elation/auth/middleware";
import elationDash from "./elation/routers/dash-router";
import elationWebhooks from "./elation/routers/webhook-router";

const routes = Router();

routes.use("/athenahealth", processCxIdDashAthena, checkMAPIAccess, athenaDash);
routes.use("/canvas", processCxIdCanvasDash, checkMAPIAccess, canvasDash);
routes.use("/elation", processCxIdElationDash, checkMAPIAccess, elationDash);

routes.use("/webhook/canvas", processCxIdCanvasWebhooks, checkMAPIAccess, canvasWebhooks);
routes.use("/webhook/elation", processCxIdElationWebhooks, checkMAPIAccess, elationWebhooks);

export default routes;
