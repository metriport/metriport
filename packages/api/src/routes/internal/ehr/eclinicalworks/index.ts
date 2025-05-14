import Router from "express-promise-router";
import launch from "./launch";

const routes = Router();

routes.use("/launch", launch);

export default routes;
