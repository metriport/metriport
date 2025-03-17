import Router from "express-promise-router";
import athena from "./athenahealth/jwt-token";
import canvas from "./canvas/jwt-token";
import elation from "./elation/jwt-token";

const routes = Router();

// EHRs
routes.use("/athenahealth", athena);
routes.use("/canvas", canvas);
routes.use("/elation", elation);

export default routes;
