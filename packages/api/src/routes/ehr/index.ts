import Router from "express-promise-router";
import { processCxId } from "../middlewares/ehr/athenahealth";
import athena from "./athenahealth";

const routes = Router();

routes.use("/athena", processCxId, athena);

export default routes;
