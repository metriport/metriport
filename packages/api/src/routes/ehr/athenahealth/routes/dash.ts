import Router from "express-promise-router";
import { handleParams } from "../../../helpers/handle-params";
import medicalDocument from "../../../medical/document";
import medicalFeatureFlags from "../../../medical/feature-flags";
import medicalInference from "../../../medical/inference";
import medicalPatient from "../../../medical/patient";
import { patientAuthorization } from "../../../middlewares/patient-authorization";
import settings from "../../../settings";
import {
  processDocumentRoute,
  processFeatureFlagsRoute,
  processInferenceRoute,
  processPatientRoute,
} from "../auth/middleware";
import chart from "../chart";
import patient from "../patient";

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
routes.use("/medical/v1/inference", handleParams, processInferenceRoute, medicalInference);
routes.use("/medical/v1/document", processDocumentRoute, medicalDocument);
routes.use("/medical/v1/feature-flags", processFeatureFlagsRoute, medicalFeatureFlags);
routes.use("/settings", settings);

export default routes;
