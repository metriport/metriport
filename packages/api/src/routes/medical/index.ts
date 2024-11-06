import Router from "express-promise-router";
import document from "./document";
import facility from "./facility";
import organization from "./organization";
import patient from "./patient";

const routes = Router();

routes.use("/organization", organization);

routes.use("/facility", facility);

// patient routes are also used in EHR Integrations routes
routes.use("/patient", patient);

// document routes are also used in EHR Integrations routes
routes.use("/document", document);

export default routes;
