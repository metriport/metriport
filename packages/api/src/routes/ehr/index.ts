import Router from "express-promise-router";
import { checkMAPIAccess } from "../middlewares/auth";
import { processCxIdDash as processCxIdDashAthena } from "./athenahealth/auth/middleware";
import athenaDash from "./athenahealth/routes/dash";
import {
  processCxIdDash as processCxIdCanvasDash,
  processCxIdWebhooks as processCxIdCanvasWebhooks,
} from "./canvas/auth/middleware";
import canvasDash from "./canvas/routes/dash";
import canvasWebhooks from "./canvas/routes/webhook";
import {
  processCxIdDash as processCxIdElationDash,
  processCxIdWebhooks as processCxIdElationWebhooks,
} from "./elation/auth/middleware";
import elationDash from "./elation/routes/dash";
import elationWebhooks from "./elation/routes/webhook";
import { processCxIdDash as processCxIdHealthieDash } from "./healthie/auth/middleware";
import healthieDash from "./healthie/routes/dash";

const routes = Router();

routes.use("/athenahealth", processCxIdDashAthena, checkMAPIAccess, athenaDash);
routes.use("/canvas", processCxIdCanvasDash, checkMAPIAccess, canvasDash);
routes.use("/elation", processCxIdElationDash, checkMAPIAccess, elationDash);
routes.use("/healthie", processCxIdHealthieDash, checkMAPIAccess, healthieDash);

routes.use("/webhook/canvas", processCxIdCanvasWebhooks, checkMAPIAccess, canvasWebhooks);
routes.use("/webhook/elation", processCxIdElationWebhooks, checkMAPIAccess, elationWebhooks);

export default routes;
