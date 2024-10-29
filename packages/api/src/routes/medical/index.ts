import Router from "express-promise-router";
import facility from "./facility";
import organization from "./organization";
import patient from "./patient";
import document from "./document";

const routes = Router();

routes.use("/facility", facility);
routes.use("/organization", organization);

routes.use("/facility", facilityRoot);
routes.use("/facility/:id", facilityAuthorization("params"), facility);

routes.use("/patient", patientRoot);
// patient routes are also used in EHR Integrations
routes.use("/patient/:id", patientAuthorization("params"), patient);

// document routes are also used in EHR Integrations
routes.use("/document", document);

export default routes;
