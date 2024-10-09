import {
  consolidationConversionType,
  demographicsSchema,
  patientCreateSchema,
} from "@metriport/api-sdk";
import { GetConsolidatedQueryProgressResponse } from "@metriport/api-sdk/medical/models/patient";
import { mrFormat } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { MAXIMUM_UPLOAD_FILE_SIZE } from "@metriport/core/external/aws/lambda-logic/document-uploader";
import { toFHIR } from "@metriport/core/external/fhir/patient/conversion";
import { getRequestId } from "@metriport/core/util/request";
import { BadRequestError, NotFoundError, stringToBoolean } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { orderBy } from "lodash";
import { z } from "zod";
import { areDocumentsProcessing } from "../../command/medical/document/document-status";
import {
  getConsolidatedPatientData,
  startConsolidatedQuery,
} from "../../command/medical/patient/consolidated-get";
import {
  getMedicalRecordSummary,
  getMedicalRecordSummaryStatus,
} from "../../command/medical/patient/create-medical-record";
import { createPatient, PatientCreateCmd } from "../../command/medical/patient/create-patient";
import { deletePatient } from "../../command/medical/patient/delete-patient";
import { getConsolidatedWebhook } from "../../command/medical/patient/get-consolidated-webhook";
import {
  getPatientOrFail,
  getPatients,
  matchPatient,
} from "../../command/medical/patient/get-patient";
import { getPatientFacilityMatches } from "../../command/medical/patient/get-patient-facility-matches";
import { handleDataContribution } from "../../command/medical/patient/handle-data-contributions";
import { PatientUpdateCmd, updatePatient } from "../../command/medical/patient/update-patient";
import { getSandboxPatientLimitForCx } from "../../domain/medical/get-patient-limit";
import { getFacilityIdOrFail } from "../../domain/medical/patient-facility";
import { countResources } from "../../external/fhir/patient/count-resources";
import { PatientModel as Patient } from "../../models/medical/patient";
import { REQUEST_ID_HEADER_NAME } from "../../routes/header";
import { Config } from "../../shared/config";
import { parseISODate } from "../../shared/date";
import { getETag } from "../../shared/http";
import { getOutputFormatFromRequest } from "../helpers/output-format";
import { requestLogger } from "../helpers/request-logger";
import {
  asyncHandler,
  getCxIdOrFail,
  getFrom,
  getFromParamsOrFail,
  getFromQueryAsBoolean,
  getFromQueryOrFail,
} from "../util";
import { dtoFromModel } from "./dtos/patientDTO";
import { bundleSchema, getResourcesQueryParam } from "./schemas/fhir";
import {
  patientUpdateSchema,
  schemaCreateToPatientData,
  schemaDemographicsToPatientData,
  schemaUpdateToPatientData,
} from "./schemas/patient";
import { cxRequestMetadataSchema } from "./schemas/request-metadata";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /patient
 *
 * Creates the patient corresponding to the specified facility at the
 * customer's organization if it doesn't exist already.
 *
 * @param  req.query.facilityId The ID of the Facility the Patient should be associated with.
 * @return The newly created patient.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityId = getFromQueryOrFail("facilityId", req);
    const rerunPdOnNewDemographics = stringToBoolean(
      getFrom("query").optional("rerunPdOnNewDemographics", req)
    );
    const forceCommonwell = stringToBoolean(getFrom("query").optional("commonwell", req));
    const forceCarequality = stringToBoolean(getFrom("query").optional("carequality", req));
    const payload = patientCreateSchema.parse(req.body);

    if (Config.isSandbox()) {
      // limit the amount of patients that can be created in sandbox mode
      const numPatients = await Patient.count({ where: { cxId } });
      const patientLimit = await getSandboxPatientLimitForCx(cxId);
      if (numPatients >= patientLimit) {
        return res.status(status.BAD_REQUEST).json({
          message: `Cannot create more than ${Config.SANDBOX_PATIENT_LIMIT} patients in Sandbox mode!`,
        });
      }
    }

    const patientCreate: PatientCreateCmd = {
      ...schemaCreateToPatientData(payload),
      cxId,
      facilityId,
    };

    const patient = await createPatient({
      patient: patientCreate,
      rerunPdOnNewDemographics,
      forceCommonwell,
      forceCarequality,
    });

    return res.status(status.CREATED).json(dtoFromModel(patient));
  })
);

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
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const id = getFromParamsOrFail("id", req);
    const facilityIdParam = getFrom("query").optional("facilityId", req);
    const rerunPdOnNewDemographics = stringToBoolean(
      getFrom("query").optional("rerunPdOnNewDemographics", req)
    );
    const forceCommonwell = stringToBoolean(getFrom("query").optional("commonwell", req));
    const forceCarequality = stringToBoolean(getFrom("query").optional("carequality", req));
    const payload = patientUpdateSchema.parse(req.body);

    const patient = await getPatientOrFail({ id, cxId });
    if (areDocumentsProcessing(patient)) {
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
 * @param   req.cxId      The customer ID.
 * @param   req.param.id  The ID of the patient to be returned.
 * @return  The customer's patients associated with the given facility.
 */
router.get(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromParamsOrFail("id", req);
    const output = getOutputFormatFromRequest(req);

    const patient = await getPatientOrFail({ id: patientId, cxId });

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
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const id = getFromParamsOrFail("id", req);
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

/** ---------------------------------------------------------------------------
 * GET /patient
 *
 * Gets all patients corresponding to the specified facility at the customer's organization.
 *
 * @param   req.cxId              The customer ID.
 * @param   req.query.facilityId  The ID of the facility the user patient is associated with (optional).
 * @return  The customer's patients associated with the given facility.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityId = getFrom("query").optional("facilityId", req);

    const patients = await getPatients({ cxId, facilityId: facilityId });

    const patientsData = patients.map(dtoFromModel);
    return res.status(status.OK).json({ patients: patientsData });
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
  "/:id/consolidated",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFrom("params").orFail("id", req);
    const resources = getResourcesQueryParam(req);
    const dateFrom = parseISODate(getFrom("query").optional("dateFrom", req));
    const dateTo = parseISODate(getFrom("query").optional("dateTo", req));
    const fromDashboard = getFromQueryAsBoolean("fromDashboard", req);
    const patient = await getPatientOrFail({ cxId, id: patientId });

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
 * @param req.cxId The customer ID.
 * @param req.param.id The ID of the patient whose data is to be returned.
 * @returns all consolidated queries for the patient that have been triggered.
 */
router.get(
  "/:id/consolidated/query",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFrom("params").orFail("id", req);
    const patient = await getPatientOrFail({ cxId, id: patientId });
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

const consolidationConversionTypeSchema = z.enum(consolidationConversionType);
const medicalRecordFormatSchema = z.enum(mrFormat);

/** ---------------------------------------------------------------------------
 * POST /patient/:id/consolidated/query
 *
 * Triggers a patient's consolidated data query. Results are sent through Webhook.
 * If the query is already in progress, just return the current status.
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
 * @param req.generateAiBrief Optional flag to include an AI-generated medical record brief into the medical record summary. Note, that you have to request access to this feature by contacting Metriport directly.
 * @return status for querying the Patient's consolidated data.
 */
router.post(
  "/:id/consolidated/query",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFrom("params").orFail("id", req);
    const resources = getResourcesQueryParam(req);
    const dateFrom = parseISODate(getFrom("query").optional("dateFrom", req));
    const dateTo = parseISODate(getFrom("query").optional("dateTo", req));
    const type = getFrom("query").optional("conversionType", req);
    const fromDashboard = getFromQueryAsBoolean("fromDashboard", req);
    const generateAiBrief = Config.isSandbox()
      ? false
      : getFromQueryAsBoolean("generateAiBrief", req);

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
      generateAiBrief,
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
 * @param req.cxId The customer ID.
 * @param req.param.id The ID of the patient whose data is to be returned.
 * @param req.query.conversionType Indicates how the medical record summary should be rendered. Accepts "pdf" or "html".
 * @return JSON containing the url to download the patient's medical record summary.
 * @throws NotFoundError if the medical record summary does not exist.
 */
router.get(
  "/:id/medical-record",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFrom("params").orFail("id", req);
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
 * @param req.cxId The customer ID.
 * @param req.param.id The ID of the patient whose data is to be returned.
 * @return JSON containing the status of the patient's medical record summary.
 */
router.get(
  "/:id/medical-record-status",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFrom("params").orFail("id", req);
    const status = await getMedicalRecordSummaryStatus({ patientId, cxId });
    return res.json(status);
  })
);

/** ---------------------------------------------------------------------------
 * POST /patient/:id/consolidated
 * @deprecated use the PUT version of this endpoint
 */
router.post("/:id/consolidated", requestLogger, asyncHandler(putConsolidated));
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
router.put("/:id/consolidated", requestLogger, asyncHandler(putConsolidated));
async function putConsolidated(req: Request, res: Response) {
  // Limit the payload size that can be created
  const contentLength = req.headers["content-length"];
  if (contentLength && parseInt(contentLength) >= MAXIMUM_UPLOAD_FILE_SIZE) {
    throw new BadRequestError(
      `Cannot create bundle with size greater than ${MAXIMUM_UPLOAD_FILE_SIZE} bytes.`
    );
  }
  const requestId = getRequestId();
  const cxId = getCxIdOrFail(req);
  const patientId = getFrom("params").orFail("id", req);
  const bundle = bundleSchema.parse(req.body);
  const results = await handleDataContribution({ requestId, patientId, cxId, bundle });
  return res.setHeader(REQUEST_ID_HEADER_NAME, requestId).status(status.OK).json(results);
}

/** ---------------------------------------------------------------------------
 * GET /patient/:id/consolidated/count
 *
 * Returns the amount of resources a patient has on the FHIR server, total and per resource.
 *
 * @param req.cxId The customer ID.
 * @param req.query.patientId The ID of the patient whose data is to be returned.
 * @param req.query.resources Optional comma-separated list of resources to be returned.
 * @param req.query.dateFrom Optional start date that resources will be filtered by (inclusive).
 * @param req.query.dateTo Optional end date that resources will be filtered by (inclusive).
 */
router.get(
  "/:id/consolidated/count",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFrom("params").orFail("id", req);
    const resources = getResourcesQueryParam(req);
    const dateFrom = parseISODate(getFrom("query").optional("dateFrom", req));
    const dateTo = parseISODate(getFrom("query").optional("dateTo", req));

    const resourceCount = await countResources({
      patient: { id: patientId, cxId },
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
 * POST /patient/match
 *
 * Searches for a patient previously created at Metriport, based on a demographic data. Returns the matched patient, if it exists.
 *
 * @return The matched patient.
 * @throws NotFoundError if the patient does not exist.
 */
router.post(
  "/match",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const payload = demographicsSchema.parse(req.body);

    const patientData = schemaDemographicsToPatientData(payload);

    const patient = await matchPatient({ cxId, ...patientData });

    if (patient) {
      return res.status(status.OK).json(dtoFromModel(patient));
    }
    throw new NotFoundError("Cannot find patient");
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
  "/:id/facility-matches",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = getFrom("params").orFail("id", req);

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
  "/:id/consolidated/webhook",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFrom("params").orFail("id", req);
    const requestId = getFrom("query").orFail("requestId", req);
    const patient = await getPatientOrFail({ cxId, id: patientId });
    const consolidatedQueries = patient.data.consolidatedQueries ?? null;

    const webhook = await getConsolidatedWebhook({ cxId, consolidatedQueries, requestId });

    return res.json(webhook);
  })
);

export default router;
