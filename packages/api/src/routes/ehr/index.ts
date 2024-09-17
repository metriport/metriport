import Router from "express-promise-router";
import { processCxId as processCxIdAthena } from "./athenahealth/auth/middleware";
import { checkMAPIAccess } from "../middlewares/auth";
import athena from "./athenahealth";

const routes = Router();

routes.use("/athenahealth", processCxIdAthena, checkMAPIAccess, athena);

export default routes;
