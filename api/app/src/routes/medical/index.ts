import Router from "express-promise-router";
import facility from "./facility";
import organization from "./organization";
import patient from "./patient";

const routes = Router();

// TODO: create mw to check whether this cx has access to the Medical API
routes.use("/facility", facility);
routes.use("/organization", organization);
routes.use("/patient", patient);

export default routes;
