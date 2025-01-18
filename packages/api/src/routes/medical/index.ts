import Router from "express-promise-router";
import { facilityAuthorization } from "../middlewares/facility-authorization";
import { patientAuthorization } from "../middlewares/patient-authorization";
import { handleParams } from "../helpers/handle-params";
import document from "./document";
import facility from "./facility";
import facilityRoot from "./facility-root";
import organization from "./organization";
import patient from "./patient";
import patientRoot from "./patient-root";
import network from "./network";

const routes = Router();

routes.use("/organization", organization);

routes.use("/facility", facilityRoot);
routes.use("/facility/:id", handleParams, facilityAuthorization("params"), facility);

routes.use("/patient", patientRoot);
// patient routes are also used in EHR Integrations routes
routes.use("/patient/:id", handleParams, patientAuthorization("params"), patient);

// document routes are also used in EHR Integrations routes
routes.use("/document", document);

routes.use("/network/", network);

export default routes;
