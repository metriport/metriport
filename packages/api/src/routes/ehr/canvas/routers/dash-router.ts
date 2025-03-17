import Router from "express-promise-router";
import medicalDocument from "../../../medical/document";
import medicalPatient from "../../../medical/patient";
import { patientAuthorization } from "../../../middlewares/patient-authorization";
import settings from "../../../settings";
import { processDocumentRoute, processPatientRoute } from "../auth/middleware";
import patient from "../patient";

const routes = Router();

routes.use("/patient", patient);
routes.use(
  "/medical/v1/patient/:id",
  processPatientRoute,
  patientAuthorization("query"),
  medicalPatient
);
routes.use(
  "/medical/v1/document",
  processDocumentRoute,
  patientAuthorization("query"),
  medicalDocument
);
routes.use("/settings", settings);

export default routes;
