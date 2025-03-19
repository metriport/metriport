import Router from "express-promise-router";
import { handleParams } from "../../../helpers/handle-params";
import medicalDocument from "../../../medical/document";
import medicalPatient from "../../../medical/patient";
import { patientAuthorization } from "../../../middlewares/patient-authorization";
import settings from "../../../settings";
import { documentDownloadUrlRegex, processEhrPatientId } from "../../shared";
import {
  processDocumentRoute,
  processPatientRoute,
  tokenEhrPatientIdQueryParam,
} from "../auth/middleware";
import chart from "../chart";
import patient from "../patient";

const routes = Router();

const documentSkipPathsForElationIdCheck = [documentDownloadUrlRegex];

routes.use("/patient", patient);
routes.use("/chart", chart);
routes.use(
  "/medical/v1/patient/:id",
  handleParams,
  processPatientRoute,
  processEhrPatientId(tokenEhrPatientIdQueryParam, "query"),
  patientAuthorization("query"),
  medicalPatient
);
routes.use(
  "/medical/v1/document",
  processDocumentRoute,
  processEhrPatientId(tokenEhrPatientIdQueryParam, "query", documentSkipPathsForElationIdCheck),
  medicalDocument
);
routes.use("/settings", settings);

export default routes;
