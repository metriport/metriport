import Router from "express-promise-router";
import athena from "../ehr/athenahealth/auth/jwt-token";
import canvas from "../ehr/canvas/auth/jwt-token";
import elation from "../ehr/elation/auth/jwt-token";

const routes = Router();

// EHRs
routes.use("/athenahealth", athena);
routes.use("/canvas", canvas);
routes.use("/elation", elation);

export default routes;
