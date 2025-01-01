import Router from "express-promise-router";
import athena from "./athenahealth/internal";
import elation from "./elation/internal";

const routes = Router();

routes.use("/athenahealth", athena);
routes.use("/elation", elation);

export default routes;
