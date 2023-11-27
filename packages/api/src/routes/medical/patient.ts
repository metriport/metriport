import { patientCreateSchema } from "@metriport/api-sdk";
import { QueryProgress as QueryProgressFromSDK } from "@metriport/api-sdk/medical/models/patient";
import { consolidationConversionType } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { z } from "zod";
import { areDocumentsProcessing } from "../../command/medical/document/document-status";
import { createOrUpdateConsolidatedPatientData } from "../../command/medical/patient/consolidated-create";
import {
  getConsolidatedPatientData,
  startConsolidatedQuery,
} from "../../command/medical/patient/consolidated-get";
import { PatientCreateCmd, createPatient } from "../../command/medical/patient/create-patient";
import { deletePatient } from "../../command/medical/patient/delete-patient";
import { getPatientOrFail, getPatients } from "../../command/medical/patient/get-patient";
import { PatientUpdateCmd, updatePatient } from "../../command/medical/patient/update-patient";
import { getFacilityIdOrFail } from "../../domain/medical/patient-facility";
import { processAsyncError } from "../../errors";
import BadRequestError from "../../errors/bad-request";
import cwCommands from "../../external/commonwell";
import { toFHIR } from "../../external/fhir/patient";
import { countResources } from "../../external/fhir/patient/count-resources";
import { upsertPatientToFHIRServer } from "../../external/fhir/patient/upsert-patient";
import { validateFhirEntries } from "../../external/fhir/shared/json-validator";
import { PatientModel as Patient } from "../../models/medical/patient";
import { Config } from "../../shared/config";
import { parseISODate } from "../../shared/date";
import { getETag } from "../../shared/http";
import {
  asyncHandler,
  getCxIdOrFail,
  getFrom,
  getFromParamsOrFail,
  getFromQueryOrFail,
} from "../util";
import { dtoFromModel } from "./dtos/patientDTO";
import { bundleSchema, getResourcesQueryParam } from "./schemas/fhir";
import {
  patientUpdateSchema,
  schemaCreateToPatient,
  schemaUpdateToPatient,
} from "./schemas/patient";
import { cxRequestMetadataSchema } from "./schemas/request-metadata";

const router = Router();
const MAX_RESOURCE_POST_COUNT = 50;
const MAX_RESOURCE_STORED_LIMIT = 1000;
const MAX_CONTENT_LENGTH_BYTES = 1_000_000;

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
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityId = getFromQueryOrFail("facilityId", req);
    const payload = patientCreateSchema.parse(req.body);

    if (Config.isSandbox()) {
      // limit the amount of patients that can be created in sandbox mode
      const numPatients = await Patient.count({ where: { cxId } });
      if (numPatients >= Config.SANDBOX_PATIENT_LIMIT) {
        return res.status(status.BAD_REQUEST).json({
          message: `Cannot create more than ${Config.SANDBOX_PATIENT_LIMIT} patients in Sandbox mode!`,
        });
      }
    }

    const patientCreate: PatientCreateCmd = {
      ...schemaCreateToPatient(payload, cxId),
      facilityId,
    };

    const patient = await createPatient(patientCreate);
    console.log("patient created", patient.id, patient.data.lastName, patient.data.firstName);

    // temp solution until we migrate to FHIR
    const fhirPatient = toFHIR(patient);
    await upsertPatientToFHIRServer(patient.cxId, fhirPatient);

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
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const id = getFromParamsOrFail("id", req);
    const facilityIdParam = getFrom("query").optional("facilityId", req);
    const payload = patientUpdateSchema.parse(req.body);

    const patient = await getPatientOrFail({ id, cxId });
    if (areDocumentsProcessing(patient)) {
      return res.status(status.LOCKED).json("Document querying currently in progress");
    }

    const facilityId = getFacilityIdOrFail(patient, facilityIdParam);

    const patientUpdate: PatientUpdateCmd = {
      ...schemaUpdateToPatient(payload, cxId),
      ...getETag(req),
      id,
    };

    const updatedPatient = await updatePatient(patientUpdate);

    // temp solution until we migrate to FHIR
    const fhirPatient = toFHIR(updatedPatient);
    await upsertPatientToFHIRServer(updatedPatient.cxId, fhirPatient);

    // TODO: #393 declarative, event-based integration
    // Intentionally asynchronous - it takes too long to perform
    cwCommands.patient
      .update(updatedPatient, facilityId)
      .catch(processAsyncError(`cw.patient.update`));

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
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromParamsOrFail("id", req);

    const patient = await getPatientOrFail({ id: patientId, cxId });

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
 * @return Patient's consolidated data.
 */
router.get(
  "/:id/consolidated",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFrom("params").orFail("id", req);
    const resources = getResourcesQueryParam(req);
    const dateFrom = parseISODate(getFrom("query").optional("dateFrom", req));
    const dateTo = parseISODate(getFrom("query").optional("dateTo", req));
    const patient = await getPatientOrFail({ id: patientId, cxId });

    const data = await getConsolidatedPatientData({
      patient,
      resources,
      dateFrom,
      dateTo,
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
 * @return status of querying for the Patient's consolidated data.
 */
router.get(
  "/:id/consolidated/query",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFrom("params").orFail("id", req);
    const patient = await getPatientOrFail({ cxId, id: patientId });
    const respPayload: QueryProgressFromSDK = {
      status: patient.data.consolidatedQuery?.status ?? null,
      message:
        "Trigger a new query by POST /patient/:id/consolidated/query; data will be sent through Webhook",
    };
    return res.json(respPayload);
  })
);

const consolidationConversionTypeSchema = z.enum(consolidationConversionType);

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
 * @param req.query.conversionType Optional to indicate how the medical record should be rendered.
 * @param req.body Optional metadata to be sent through Webhook.
 * @return status of querying for the Patient's consolidated data.
 */
router.post(
  "/:id/consolidated/query",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFrom("params").orFail("id", req);
    const resources = getResourcesQueryParam(req);
    const dateFrom = parseISODate(getFrom("query").optional("dateFrom", req));
    const dateTo = parseISODate(getFrom("query").optional("dateTo", req));
    const type = getFrom("query").optional("conversionType", req);
    const conversionType = type ? consolidationConversionTypeSchema.parse(type) : undefined;
    const cxConsolidatedRequestMetadata = cxRequestMetadataSchema.parse(req.body);

    const queryResponse = await startConsolidatedQuery({
      cxId,
      patientId,
      resources,
      dateFrom,
      dateTo,
      conversionType,
      cxConsolidatedRequestMetadata: cxConsolidatedRequestMetadata?.metadata,
    });
    const respPayload: QueryProgressFromSDK = {
      status: queryResponse.status ?? null,
    };
    return res.json(respPayload);
  })
);

/** ---------------------------------------------------------------------------
 * POST /patient/:id/consolidated
 * @deprecated use the PUT version of this endpoint
 */
router.post("/:id/consolidated", asyncHandler(putConsolidated));
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
router.put("/:id/consolidated", asyncHandler(putConsolidated));
async function putConsolidated(req: Request, res: Response) {
  // Limit the payload size that can be created
  const contentLength = req.headers["content-length"];
  if (contentLength && parseInt(contentLength) >= MAX_CONTENT_LENGTH_BYTES) {
    throw new BadRequestError(
      `Cannot create bundle with size greater than ${MAX_CONTENT_LENGTH_BYTES} bytes.`
    );
  }

  const cxId = getCxIdOrFail(req);
  const patientId = getFrom("params").orFail("id", req);
  const patient = await getPatientOrFail({ id: patientId, cxId });

  const fhirBundle = bundleSchema.parse(req.body);
  const validatedBundle = validateFhirEntries(fhirBundle);
  const incomingAmount = validatedBundle.entry.length;

  // Limit the amount of resources per patient
  if (!Config.isCloudEnv() || Config.isSandbox()) {
    const { total: currentAmount } = await countResources({
      patient: { id: patientId, cxId },
    });
    if (currentAmount + incomingAmount > MAX_RESOURCE_STORED_LIMIT) {
      throw new BadRequestError(
        `Reached maximum number of resources per patient in Sandbox mode ` +
          `(current: ${currentAmount}, incoming: ${incomingAmount}, max: ${MAX_RESOURCE_STORED_LIMIT})`
      );
    }
    // Limit the amount of resources that can be created at once
    if (incomingAmount > MAX_RESOURCE_POST_COUNT) {
      throw new BadRequestError(
        `Cannot create more than ${MAX_RESOURCE_POST_COUNT} resources at a time ` +
          `(incoming: ${incomingAmount})`
      );
    }
  }
  console.log(
    `[PUT /consolidated] cxId ${cxId}, patientId ${patientId}] ` +
      `${incomingAmount} resources, ${contentLength} bytes`
  );
  const data = await createOrUpdateConsolidatedPatientData({
    cxId,
    patientId: patient.id,
    fhirBundle: validatedBundle,
  });
  return res.json(data);
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

export default router;
