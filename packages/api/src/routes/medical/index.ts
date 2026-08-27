import Router from "express-promise-router";
import { handleParams } from "../helpers/handle-params";
import { facilityAuthorization } from "../middlewares/facility-authorization";
import { patientAuthorization } from "../middlewares/patient-authorization";
import cohort from "./cohort";
import document from "./document";
import embedToken from "./embed-token";
import facility from "./facility";
import facilityRoot from "./facility-root";
import featureFlags from "./feature-flags";
import inference from "./inference";
import networkEntry from "./network-entry";
import networkQuery from "./network-query";
import patient from "./patient";
import patientRoot from "./patient-root";

const routes = Router();

routes.use("/facility", facilityRoot);
routes.use("/facility/:id", handleParams, facilityAuthorization("params"), facility);

routes.use("/cohort", cohort);

routes.use("/patient", patientRoot);
// patient routes are also used in EHR Integrations routes
routes.use("/patient/:id", handleParams, patientAuthorization("params"), patient);

// document routes are also used in EHR Integrations routes
routes.use("/document", document);
routes.use("/network", networkQuery);
// feature flags routes are also used in EHR Integrations routes
routes.use("/feature-flags", featureFlags);

routes.use("/network-entry", networkEntry);
routes.use("/inference", inference);
routes.use("/token", embedToken);

export default routes;
