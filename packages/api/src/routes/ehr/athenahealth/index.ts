import Router from "express-promise-router";
import { processPatientRoute, processDocuemntRoute } from "./auth/middleware";
import patient from "./patient";
import medicalPatient from "../../medical/patient";
import medicalDocument from "../../medical/document";
import settings from "../../settings";

const routes = Router();

routes.use("/patient", patient);
routes.use("/medical/v1/patient", processPatientRoute, medicalPatient);
routes.use("/medical/v1/document", processDocuemntRoute, medicalDocument);
routes.use("/settings", settings);

export default routes;
