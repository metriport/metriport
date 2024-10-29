import Router from "express-promise-router";
import { patientAuthorization } from "../../middlewares/patient-authorization";
import { processPatientRoute, processDocumentRoute } from "./auth/middleware";
import patient from "./patient";
import chart from "./chart";
import medicalPatientRoot from "../../medical/patient-root";
import medicalPatient from "../../medical/patient";
import medicalDocument from "../../medical/document";
import settings from "../../settings";

const routes = Router();

routes.use("/patient", patient);
routes.use("/chart", chart);
routes.use("/medical/v1/patient", processPatientRoute, medicalPatientRoot);
routes.use(
  "/medical/v1/patient/:id",
  processPatientRoute,
  patientAuthorization("params"),
  medicalPatient
);
routes.use("/medical/v1/document", processDocumentRoute, medicalDocument);
routes.use("/settings", settings);

export default routes;
