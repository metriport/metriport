import Router from "express-promise-router";
import facility from "./facility";
import organization from "./organization";
import patient from "./patient";
import link from "./link";

const routes = Router();

routes.use("/facility", facility);
routes.use("/organization", organization);
routes.use("/patient", patient, link);

export default routes;
