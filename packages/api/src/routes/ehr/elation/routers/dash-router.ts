import Router from "express-promise-router";
import { patientAuthorization } from "../../../middlewares/patient-authorization";
import { processPatientRoute, processDocumentRoute } from "../auth/middleware";
import { handleParams } from "../../../helpers/handle-params";
import patient from "../patient";
import chart from "../chart";
import medicalPatient from "../../../medical/patient";
import medicalDocument from "../../../medical/document";
import settings from "../../../settings";

const routes = Router();

routes.use("/patient", patient);
routes.use("/chart", chart);
routes.use(
  "/medical/v1/patient/:id",
  handleParams,
  processPatientRoute,
  patientAuthorization("query"),
  medicalPatient
);
routes.use("/medical/v1/document", processDocumentRoute, medicalDocument);
routes.use("/settings", settings);

export default routes;
