import Router from "express-promise-router";
import { processCxId as processCxIdAthena } from "./athenahealth/auth/middleware";
import athena from "./athenahealth";

const routes = Router();

routes.use("/athenahealth", processCxIdAthena, athena);

export default routes;
