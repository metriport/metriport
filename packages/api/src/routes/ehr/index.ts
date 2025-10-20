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
import { processCxIdDash as processCxIdEclinicalworksDash } from "./eclinicalworks/auth/middleware";
import eclinicalworksDash from "./eclinicalworks/routes/dash";
import {
  processCxIdDash as processCxIdElationDash,
  processCxIdWebhooks as processCxIdElationWebhooks,
} from "./elation/auth/middleware";
import elationDash from "./elation/routes/dash";
import elationWebhooks from "./elation/routes/webhook";
import {
  processCxIdDash as processCxIdHealthieDash,
  processCxIdWebhooks as processCxIdHealthieWebhooks,
} from "./healthie/auth/middleware";
import healthieDash from "./healthie/routes/dash";
import healthieWebhooks from "./healthie/routes/webhook";
import { processCxIdDash as processCxIdSalesforceDash } from "./salesforce/auth/middleware";
import salesforceDash from "./salesforce/routes/dash";

const routes = Router();

routes.use("/athenahealth", processCxIdDashAthena, checkMAPIAccess, athenaDash);
routes.use("/canvas", processCxIdCanvasDash, checkMAPIAccess, canvasDash);
routes.use("/elation", processCxIdElationDash, checkMAPIAccess, elationDash);
routes.use("/healthie", processCxIdHealthieDash, checkMAPIAccess, healthieDash);
routes.use("/eclinicalworks", processCxIdEclinicalworksDash, checkMAPIAccess, eclinicalworksDash);
routes.use("/salesforce", processCxIdSalesforceDash, checkMAPIAccess, salesforceDash);

routes.use("/webhook/canvas", processCxIdCanvasWebhooks, checkMAPIAccess, canvasWebhooks);
routes.use("/webhook/elation", processCxIdElationWebhooks, checkMAPIAccess, elationWebhooks);
routes.use("/webhook/healthie", processCxIdHealthieWebhooks, checkMAPIAccess, healthieWebhooks);

export default routes;
