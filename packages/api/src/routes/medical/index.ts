import Router from "express-promise-router";
import { facilityAuthorization } from "../middlewares/facility-authorization";
import { patientAuthorization } from "../middlewares/patient-authorization";
import document from "./document";
import facility from "./facility";
import facilityRoot from "./facility-root";
import organization from "./organization";
import patient from "./patient";
import patientRoot from "./patient-root";

const routes = Router();

routes.use("/organization", organization);

routes.use("/facility", facilityRoot);
routes.use("/facility/:id", facilityAuthorization("params"), facility);

routes.use("/patient", patientRoot);
// patient routes are also used in EHR Integrations routes
routes.use("/patient/:id", patientAuthorization("params"), patient);

// document routes are also used in EHR Integrations routes
routes.use("/document", document);

export default routes;
