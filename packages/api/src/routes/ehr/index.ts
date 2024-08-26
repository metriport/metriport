import Router from "express-promise-router";
import athena from "./athenahealth";

const routes = Router();

routes.use("/athena", athena);

export default routes;
