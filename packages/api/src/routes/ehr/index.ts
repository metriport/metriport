import Router from "express-promise-router";
import { processCxId as processCxIdAthena } from "./athenahealth/auth/middleware";
import { processCxId as processCxIdCanvas } from "./canvas/auth/middleware";
import { processCxId as processCxIdElation } from "./elation/auth/middleware";
import { checkMAPIAccess } from "../middlewares/auth";
import athena from "./athenahealth";
import canvas from "./canvas";
import elation from "./elation";

const routes = Router();

routes.use("/athenahealth", processCxIdAthena, checkMAPIAccess, athena);
routes.use("/canvas", processCxIdCanvas, checkMAPIAccess, canvas);
routes.use("/elation", processCxIdElation, checkMAPIAccess, elation);

export default routes;
