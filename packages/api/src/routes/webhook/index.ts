import Router from "express-promise-router";
import garmin from "./garmin";
import apple from "./apple";
import withings from "./withings";
import { processCxId } from "../middlewares/auth";
import fitbit from "./fitbit";
import tenovi from "./tenovi";
const routes = Router();

routes.use("/garmin", garmin);
routes.use("/withings", withings);
routes.use("/apple", processCxId, apple);
routes.use("/fitbit", fitbit);
routes.use("/tenovi", tenovi);

export default routes;
