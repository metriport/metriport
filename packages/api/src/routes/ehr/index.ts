import Router from "express-promise-router";
import { processCxId as processCxIdAthena } from "./athenahealth/auth/middleware";
import { processCxId as processCxIdCanvas } from "./canvas/auth/middleware";
import { checkMAPIAccess } from "../middlewares/auth";
import athena from "./athenahealth";
import canvas from "./canvas";

const routes = Router();

routes.use("/athenahealth", processCxIdAthena, checkMAPIAccess, athena);
routes.use("/canvas", processCxIdCanvas, checkMAPIAccess, canvas);

export default routes;
