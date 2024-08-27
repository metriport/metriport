import Router from "express-promise-router";
import { processCxId as processCxIdAthena } from "./athenahealth/middleware";
import athena from "./athenahealth/patient";
import athenaJwt from "./athenahealth/jwt";

const routes = Router();

routes.use("/athena/token", athenaJwt);
routes.use("/athena", processCxIdAthena, athena);

export default routes;
