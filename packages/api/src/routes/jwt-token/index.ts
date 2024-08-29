import Router from "express-promise-router";
import athena from "../ehr/athenahealth/auth/jwt-token";

const routes = Router();

// EHRs
routes.use("/athenahealth", athena);

export default routes;
