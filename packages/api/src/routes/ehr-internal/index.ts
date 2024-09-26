import Router from "express-promise-router";
import athena from "./athenahealth/internal";

const routes = Router();

routes.use("/athenahealth", athena);

export default routes;
