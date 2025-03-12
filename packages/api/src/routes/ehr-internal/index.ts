import Router from "express-promise-router";
import athena from "./athenahealth/internal";
import canvas from "./canvas/internal";
import elation from "./elation/internal";

const routes = Router();

routes.use("/athenahealth", athena);
routes.use("/elation", elation);
routes.use("/canvas", canvas);

export default routes;
