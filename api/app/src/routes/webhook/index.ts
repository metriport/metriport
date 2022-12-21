import Router from "express-promise-router";
import garmin from "./garmin";

const routes = Router();

routes.use("/garmin", garmin);

export default routes;
