import Router from "express-promise-router";
import { processCxId as processCxIdAthena } from "./athenahealth/auth/middleware";
import { checkMAPIAccess } from "../middlewares/auth";
import athena from "./athenahealth";
import canvas from "./canvas";
import oauth2 from "./canvas/oauth2";

const routes = Router();

routes.use("/athenahealth", processCxIdAthena, checkMAPIAccess, athena);
routes.use("/canvas", processCxIdAthena, canvas);
routes.use("/canvas/oauth2", oauth2);

export default routes;
