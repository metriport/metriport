import Router from "express-promise-router";
import { handleParams } from "../../../helpers/handle-params";
import medicalCohort from "../../../medical/cohort";
import medicalDocument from "../../../medical/document";
import medicalFacilityRoot from "../../../medical/facility-root";
import medicalFeatureFlags from "../../../medical/feature-flags";
import medicalInference from "../../../medical/inference";
import medicalPatient from "../../../medical/patient";
import medicalTcmEncounter from "../../../medical/tcm-encounter";
import { patientAuthorization } from "../../../middlewares/patient-authorization";
import settings from "../../../settings";
import {
  processCohortRoute,
  processDocumentRouteSkipMapping,
  processFacilityRoute,
  processFeatureFlagsRoute,
  processInferenceRoute,
  processPatientRouteSkipMapping,
  processTcmEncounterRoute,
} from "../auth/middleware";

const routes = Router();

routes.use(
  "/medical/v1/patient/:id",
  handleParams,
  processPatientRouteSkipMapping,
  patientAuthorization("params"),
  medicalPatient
);
routes.use("/medical/v1/inference", handleParams, processInferenceRoute, medicalInference);
routes.use("/medical/v1/document", processDocumentRouteSkipMapping, medicalDocument);
routes.use("/medical/v1/feature-flags", processFeatureFlagsRoute, medicalFeatureFlags);
routes.use("/medical/v1/facility", processFacilityRoute, medicalFacilityRoot);
routes.use("/medical/v1/cohort", processCohortRoute, medicalCohort);
routes.use("/medical/v1/tcm/encounter", processTcmEncounterRoute, medicalTcmEncounter);
routes.use("/settings", settings);

export default routes;
