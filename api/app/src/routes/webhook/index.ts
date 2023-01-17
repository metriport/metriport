import Router from "express-promise-router";
import garmin from "./garmin";
import apple from "./apple";

const routes = Router();

routes.use("/garmin", garmin);
routes.use("/apple", apple);

export default routes;
