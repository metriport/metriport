import Router from "express-promise-router";
import { processCxId as processCxIdAthena } from "./athenahealth/auth/middleware";
import { processCxIdCanvas } from "./shared";
import { checkMAPIAccess } from "../middlewares/auth";
import athena from "./athenahealth";
import canvas from "./canvas";
import oauth2 from "./canvas/oauth2";

const routes = Router();

routes.use("/athenahealth", processCxIdAthena, checkMAPIAccess, athena);
routes.use("/canvas/oauth2", oauth2);
routes.use("/canvas", processCxIdCanvas, canvas);

export default routes;
