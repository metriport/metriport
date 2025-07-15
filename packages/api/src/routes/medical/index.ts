import Router from "express-promise-router";
import { handleParams } from "../helpers/handle-params";
import { facilityAuthorization } from "../middlewares/facility-authorization";
import { patientAuthorization } from "../middlewares/patient-authorization";
import document from "./document";
import cohort from "./cohort";
import facility from "./facility";
import facilityRoot from "./facility-root";
import networkEntry from "./network-entry";
import organization from "./organization";
import patient from "./patient";
import mapping from "./mapping";
import patientRoot from "./patient-root";

const routes = Router();

routes.use("/organization", organization);

routes.use("/facility", facilityRoot);
routes.use("/facility/:id", handleParams, facilityAuthorization("params"), facility);

routes.use("/cohort", cohort);

routes.use("/patient", patientRoot);
// patient routes are also used in EHR Integrations routes
routes.use("/patient/:id", handleParams, patientAuthorization("params"), patient);

// document routes are also used in EHR Integrations routes
routes.use("/document", document);

routes.use("/mapping", mapping);

routes.use("/network-entry", networkEntry);

export default routes;
