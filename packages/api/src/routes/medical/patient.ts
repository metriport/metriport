import { ConsolidatedQuery, consolidationConversionType } from "@metriport/api-sdk";
import { GetConsolidatedQueryProgressResponse } from "@metriport/api-sdk/medical/models/patient";
import { mrFormat } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { MAXIMUM_UPLOAD_FILE_SIZE } from "@metriport/core/external/aws/lambda-logic/document-uploader";
import { toFHIR } from "@metriport/core/external/fhir/patient/conversion";
import { getRequestId } from "@metriport/core/util/request";
import { BadRequestError, isTrue, NotFoundError, stringToBoolean } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { orderBy } from "lodash";
import { z } from "zod";
import { getCurrentGlobalDocumentQueryProgress } from "../../command/medical/document-query";
import { areDocumentsProcessing } from "../../command/medical/document/document-query";
import {
  getConsolidatedPatientData,
  startConsolidatedQuery,
} from "../../command/medical/patient/consolidated-get";
import {
  getMedicalRecordSummary,
  getMedicalRecordSummaryStatus,
} from "../../command/medical/patient/create-medical-record";
import { handleDataContribution } from "../../command/medical/patient/data-contribution/handle-data-contributions";
import { deletePatient } from "../../command/medical/patient/delete-patient";
import { getConsolidatedWebhook } from "../../command/medical/patient/get-consolidated-webhook";
import { getPatientFacilityMatches } from "../../command/medical/patient/get-patient-facility-matches";
import { getHieOptOut, setHieOptOut } from "../../command/medical/patient/update-hie-opt-out";
import { PatientUpdateCmd, updatePatient } from "../../command/medical/patient/update-patient";
import { getFacilityIdOrFail } from "../../domain/medical/patient-facility";
import { countResources } from "../../external/fhir/patient/count-resources";
import { REQUEST_ID_HEADER_NAME } from "../../routes/header";
import { parseISODate } from "../../shared/date";
import { getETag } from "../../shared/http";
import { getOutputFormatFromRequest } from "../helpers/output-format";
import { requestLogger } from "../helpers/request-logger";
import { getPatientInfoOrFail } from "../middlewares/patient-authorization";
import { checkRateLimit } from "../middlewares/rate-limiting";
import { asyncHandler, getFrom, getFromQueryAsBoolean } from "../util";
import { dtoFromModel } from "./dtos/patientDTO";
import { bundleSchema, getResourcesQueryParam } from "./schemas/fhir";
import {
  PatientHieOptOutResponse,
  patientUpdateSchema,
  schemaUpdateToPatientData,
} from "./schemas/patient";
import { cxRequestMetadataSchema } from "./schemas/request-metadata";

const router = Router();

/** ---------------------------------------------------------------------------
 * PUT /patient/:id
 *
 * Updates the patient corresponding to the specified facility at the customer's organization.
 * Note: this is not a PATCH, so requests must include all patient data in the payload.
 *
 * @param req.query.facilityId The facility providing NPI for the patient update
 * @return The patient to be updated
 */
router.put(
  "/",
  checkRateLimit("patientCreateOrUpdate"),
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id, patient } = getPatientInfoOrFail(req);
    const facilityIdParam = getFrom("query").optional("facilityId", req);
    const rerunPdOnNewDemographics = stringToBoolean(
      getFrom("query").optional("rerunPdOnNewDemographics", req)
    );
    const forceCommonwell = stringToBoolean(getFrom("query").optional("commonwell", req));
    const forceCarequality = stringToBoolean(getFrom("query").optional("carequality", req));
    const payload = patientUpdateSchema.parse(req.body);

    const documentQueryProgress = await getCurrentGlobalDocumentQueryProgress({
      cxId,
      patientId: patient.id,
    });
    if (documentQueryProgress && areDocumentsProcessing(documentQueryProgress)) {
      return res.status(status.LOCKED).json("Document querying currently in progress");
    }

    const facilityId = getFacilityIdOrFail(patient, facilityIdParam);
    const patientUpdate: PatientUpdateCmd = {
      ...schemaUpdateToPatientData(payload),
      ...getETag(req),
      cxId,
      id,
      facilityId,
    };

    const updatedPatient = await updatePatient({
      patientUpdate,
      rerunPdOnNewDemographics,
      forceCommonwell,
      forceCarequality,
    });

    return res.status(status.OK).json(dtoFromModel(updatedPatient));
  })
);

/** ---------------------------------------------------------------------------
 * GET /patient/:id
 *
 * Returns a patient corresponding to the specified facility at the customer's organization.
 *
 * USED WITHIN EHR INTEGRATION.
 *
 * @param   req.cxId      The customer ID.
 * @param   req.param.id  The ID of the patient to be returned.
 * @return  The customer's patients associated with the given facility.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { patient } = getPatientInfoOrFail(req);
    const output = getOutputFormatFromRequest(req);

    if (output === "fhir") return res.status(status.OK).json(toFHIR(patient));
    return res.status(status.OK).json(dtoFromModel(patient));
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /patient/:id
 *
 * Deletes a patient from our DB and HIEs.
 *
 * @param req.query.facilityId The facility providing NPI for the patient delete
 * @return 204 No Content
 */
router.delete(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id } = getPatientInfoOrFail(req);
    const facilityId = getFrom("query").optional("facilityId", req);

    const patientDeleteCmd = {
      ...getETag(req),
      id,
      cxId,
      facilityId,
    };
    await deletePatient(patientDeleteCmd);

    return res.sendStatus(status.NO_CONTENT);
  })
);

// TODO #870 move this to internal
/** ---------------------------------------------------------------------------
 * GET /patient/:id/consolidated
 * @deprecated use /patient/:id/consolidated/query instead
 *
 * Returns a patient's consolidated data.
 *
 * @param req.cxId The customer ID.
 * @param req.param.id The ID of the patient whose data is to be returned.
 * @param req.query.resources Optional comma-separated list of resources to be returned.
 * @param req.query.dateFrom Optional start date that resources will be filtered by (inclusive).
 * @param req.query.dateTo Optional end date that resources will be filtered by (inclusive).
 * @param req.query.fromDashboard Optional parameter to indicate that the request is coming from the dashboard.
 * @return Patient's consolidated data.
 */
router.get(
  "/consolidated",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { patient } = getPatientInfoOrFail(req);
    const resources = getResourcesQueryParam(req);
    const dateFrom = parseISODate(getFrom("query").optional("dateFrom", req));
    const dateTo = parseISODate(getFrom("query").optional("dateTo", req));
    const fromDashboard = getFromQueryAsBoolean("fromDashboard", req);

    const data = await getConsolidatedPatientData({
      patient,
      resources,
      dateFrom,
      dateTo,
      fromDashboard,
    });

    return res.json(data);
  })
);

/** ---------------------------------------------------------------------------
 * GET /patient/:id/consolidated/query
 *
 * Returns a patient's consolidated data query status.
 * To trigger a new consolidated query, call POST /patient/:id/consolidated/query.
 *
 * USED WITHIN EHR INTEGRATION.
 *
 * @param req.cxId The customer ID.
 * @param req.param.id The ID of the patient whose data is to be returned.
 * @returns all consolidated queries for the patient that have been triggered.
 */
router.get(
  "/consolidated/query",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { patient } = getPatientInfoOrFail(req);
    const consolidatedQueries = patient.data.consolidatedQueries ?? null;
    const mostRecentQuery = orderBy(consolidatedQueries, "startedAt", "desc")[0];

    const respPayload: GetConsolidatedQueryProgressResponse = {
      /** @deprecated status should no longer be used. Refer to queries in the consolidatedQueries array instead. */
      status: mostRecentQuery?.status ?? null,
      queries: consolidatedQueries ?? null,
      message:
        "Trigger a new query by POST /patient/:id/consolidated/query; data will be sent through Webhook",
    };

    return res.json(respPayload);
  })
);

/** ---------------------------------------------------------------------------
 * GET /patient/:id/consolidated/query/:requestId
 *
 * Returns the status and information on a specific consolidated query for a given patient.
 *
 * @param req.param.id The ID of the patient whose consolidated query status is to be returned.
 * @param req.param.requestId The ID of the query status to be returned.
 * @returns the status and information on a specific consolidated query for a given patient.
 */
router.get(
  "/consolidated/query/:requestId",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { patient } = getPatientInfoOrFail(req);
    const requestId = getFrom("params").orFail("requestId", req);
    const query = patient.data.consolidatedQueries?.find(
      (q: ConsolidatedQuery) => q.requestId === requestId
    );
    if (!query) throw new NotFoundError("Consolidated query not found");

    return res.status(status.OK).json(query);
  })
);

const consolidationConversionTypeSchema = z.enum(consolidationConversionType);
const medicalRecordFormatSchema = z.enum(mrFormat);

/** ---------------------------------------------------------------------------
 * POST /patient/:id/consolidated/query
 *
 * Triggers a patient's consolidated data query. Results are sent through Webhook.
 * If the query is already in progress, just return the current status.
 *
 * USED WITHIN EHR INTEGRATION.
 *
 * @param req.cxId The customer ID.
 * @param req.param.id The ID of the patient whose data is to be returned.
 * @param req.query.resources Optional comma-separated list of resources to be returned.
 * @param req.query.dateFrom Optional start date that resources will be filtered by (inclusive).
 * @param req.query.dateTo Optional end date that resources will be filtered by (inclusive).
 * @param req.query.conversionType Optional to indicate the file format you get the document back in.
 *        Accepts "pdf", "html", and "json". If provided, the Webhook payload will contain a signed URL to download
 *        the file, which is active for 3 minutes. If not provided, will send json payload in the webhook.
 * @param req.body Optional metadata to be sent through Webhook.
 * @param req.query.fromDashboard Optional parameter to indicate that the request is coming from the dashboard.
 * @return status for querying the Patient's consolidated data.
 */
router.post(
  "/consolidated/query",
  checkRateLimit("consolidatedDataQuery"),
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id: patientId } = getPatientInfoOrFail(req);
    const resources = getResourcesQueryParam(req);
    const dateFrom = parseISODate(getFrom("query").optional("dateFrom", req));
    const dateTo = parseISODate(getFrom("query").optional("dateTo", req));
    const type = getFrom("query").optional("conversionType", req);
    const fromDashboard = getFromQueryAsBoolean("fromDashboard", req);

    const conversionType = type ? consolidationConversionTypeSchema.parse(type) : undefined;
    const cxConsolidatedRequestMetadata = cxRequestMetadataSchema.parse(req.body);

    const respPayload = await startConsolidatedQuery({
      cxId,
      patientId,
      resources,
      dateFrom,
      dateTo,
      conversionType,
      cxConsolidatedRequestMetadata: cxConsolidatedRequestMetadata?.metadata,
      fromDashboard,
    });

    return res.json(respPayload);
  })
);

/**
 * GET /patient/:id/medical-record
 *
 * Returns the url to download a patient's medical record summary, if it exists.
 *
 * USED WITHIN EHR INTEGRATION.
 *
 * @param req.cxId The customer ID.
 * @param req.param.id The ID of the patient whose data is to be returned.
 * @param req.query.conversionType Indicates how the medical record summary should be rendered. Accepts "pdf" or "html".
 * @return JSON containing the url to download the patient's medical record summary.
 * @throws NotFoundError if the medical record summary does not exist.
 */
router.get(
  "/medical-record",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id: patientId } = getPatientInfoOrFail(req);
    const type = getFrom("query").orFail("conversionType", req);
    const conversionType = medicalRecordFormatSchema.parse(type);

    const url = await getMedicalRecordSummary({ patientId, cxId, conversionType });
    if (!url) throw new NotFoundError("Medical record summary not found");
    return res.json({ url });
  })
);

/**
 * GET /patient/:id/medical-record-status
 *
 * Checks if a patient's medical record summary exists in either PDF or HTML format and the date it was created.
 *
 * USED WITHIN EHR INTEGRATION.
 *
 * @param req.cxId The customer ID.
 * @param req.param.id The ID of the patient whose data is to be returned.
 * @return JSON containing the status of the patient's medical record summary.
 */
router.get(
  "/medical-record-status",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id: patientId } = getPatientInfoOrFail(req);
    const status = await getMedicalRecordSummaryStatus({ patientId, cxId });
    return res.json(status);
  })
);

/** ---------------------------------------------------------------------------
 * POST /patient/:id/consolidated
 * @deprecated use the PUT version of this endpoint
 */
router.post("/consolidated", requestLogger, asyncHandler(putConsolidated));
/** ---------------------------------------------------------------------------
 * PUT /patient/:id/consolidated
 *
 * Adds or updates resources from a FHIR bundle to/into the FHIR server.
 *
 * @param req.cxId The customer ID.
 * @param req.param.id The ID of the patient to associate resources to.
 * @param req.body The FHIR Bundle to create or update resources.
 * @return FHIR Bundle with operation outcome.
 */
router.put("/consolidated", requestLogger, asyncHandler(putConsolidated));
async function putConsolidated(req: Request, res: Response) {
  // Limit the payload size that can be created
  const contentLength = req.headers["content-length"];
  if (contentLength && parseInt(contentLength) >= MAXIMUM_UPLOAD_FILE_SIZE) {
    throw new BadRequestError(
      `Cannot create bundle with size greater than ${MAXIMUM_UPLOAD_FILE_SIZE} bytes.`
    );
  }
  const requestId = getRequestId();
  const { cxId, id: patientId } = getPatientInfoOrFail(req);
  const bundle = bundleSchema.parse(req.body);
  const results = await handleDataContribution({ requestId, patientId, cxId, bundle });
  return res.setHeader(REQUEST_ID_HEADER_NAME, requestId).status(status.OK).json(results);
}

/** ---------------------------------------------------------------------------
 * GET /patient/:id/consolidated/count
 *
 * Returns the amount of resources a patient has on the FHIR server, total and per resource.
 *
 * USED WITHIN EHR INTEGRATION.
 *
 * @param req.cxId The customer ID.
 * @param req.query.patientId The ID of the patient whose data is to be returned.
 * @param req.query.resources Optional comma-separated list of resources to be returned.
 * @param req.query.dateFrom Optional start date that resources will be filtered by (inclusive).
 * @param req.query.dateTo Optional end date that resources will be filtered by (inclusive).
 */
router.get(
  "/consolidated/count",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { patient } = getPatientInfoOrFail(req);
    const resources = getResourcesQueryParam(req);
    const dateFrom = parseISODate(getFrom("query").optional("dateFrom", req));
    const dateTo = parseISODate(getFrom("query").optional("dateTo", req));

    const resourceCount = await countResources({
      patient,
      resources,
      dateFrom,
      dateTo,
    });

    return res.json({
      ...resourceCount,
      filter: {
        resources: resources.length ? resources : "all",
        dateFrom,
        dateTo,
      },
    });
  })
);

/** ---------------------------------------------------------------------------
 * GET /patient/:id/facility-matches
 *
 * returns the all the facilities the patient is matched to.
 *
 * @param req.param.id The ID of the patient whose facility matches are to be returned.
 * @return The patient's facility matches.
 */
router.get(
  "/facility-matches",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { id: patientId } = getPatientInfoOrFail(req);

    const facilityMatches = await getPatientFacilityMatches({ patientId });

    return res.json(facilityMatches);
  })
);

/** ---------------------------------------------------------------------------
 * GET /patient/:id/consolidated/webhook
 *
 * Returns the webhook.
 *
 * @param req.cxId The customer ID.
 * @param req.param.patientId The ID of the patient whose data is to be returned.
 * @param req.query.requestId The ID of the request.
 */
router.get(
  "/consolidated/webhook",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, patient } = getPatientInfoOrFail(req);
    const requestId = getFrom("query").orFail("requestId", req);
    const consolidatedQueries = patient.data.consolidatedQueries ?? null;

    const webhook = await getConsolidatedWebhook({ cxId, consolidatedQueries, requestId });

    return res.json(webhook);
  })
);

/** ---------------------------------------------------------------------------
 * PUT /patient/:id/hie-opt-out
 *
 * Returns whether the patient is opted out of data pulling and sharing.
 *
 * @param req.cxId The customer ID.
 * @param req.param.id The ID of the patient whose data is to be returned.
 * @param req.query.hieOptOut Boolean value to opt patient out or in.
 */
router.put(
  "/hie-opt-out",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id } = getPatientInfoOrFail(req);
    // TODO #2475 SEND THE hieOptOut ID IN THE BODY
    const hieOptOut = isTrue(getFrom("query").orFail("hieOptOut", req));

    const result = await setHieOptOut({ patientId: id, cxId, hieOptOut });

    const respPayload: PatientHieOptOutResponse = {
      id: result.id,
      hieOptOut: result.hieOptOut ?? false,
      message: `Patient has been opted ${result.hieOptOut ? "out from" : "in to"} the networks`,
    };

    return res.status(status.OK).json(respPayload);
  })
);

// TODO #2475 expose this on the patient
/** ---------------------------------------------------------------------------
 * GET /patient/:id/hie-opt-out
 *
 * Returns whether the patient is opted out of data pulling and sharing.
 *
 * @param req.cxId The customer ID.
 * @param req.param.patientId The ID of the patient whose data is to be returned.
 */
router.get(
  "/hie-opt-out",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, patient } = getPatientInfoOrFail(req);

    const hieOptOut = await getHieOptOut({ cxId, patientId: patient.id });

    const respPayload: PatientHieOptOutResponse = {
      id: patient.id,
      hieOptOut: hieOptOut,
      message: `Patient has opted ${hieOptOut ? "out from" : "in to"} the networks`,
    };

    return res.status(status.OK).json(respPayload);
  })
);

export default router;
