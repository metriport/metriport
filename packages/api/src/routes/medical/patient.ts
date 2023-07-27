import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { z } from "zod";
import { areDocumentsProcessing } from "../../command/medical/document/document-status";
import {
  getConsolidatedPatientData,
  resourceTypeForConsolidation,
} from "../../command/medical/patient/get-consolidate-data";
import { createPatient, PatientCreateCmd } from "../../command/medical/patient/create-patient";
import { deletePatient } from "../../command/medical/patient/delete-patient";
import { getPatientOrFail, getPatients } from "../../command/medical/patient/get-patient";
import { PatientUpdateCmd, updatePatient } from "../../command/medical/patient/update-patient";
import { processAsyncError } from "../../errors";
import cwCommands from "../../external/commonwell";
import { toFHIR } from "../../external/fhir/patient";
import { upsertPatientToFHIRServer } from "../../external/fhir/patient/upsert-patient";
import { PatientModel as Patient } from "../../models/medical/patient";
import { Config } from "../../shared/config";
import { parseISODate } from "../../shared/date";
import {
  asyncHandler,
  getCxIdOrFail,
  getETag,
  getFrom,
  getFromParamsOrFail,
  getFromQueryOrFail,
} from "../util";
import { dtoFromModel } from "./dtos/patientDTO";
import {
  patientCreateSchema,
  patientUpdateSchema,
  schemaCreateToPatient,
  schemaUpdateToPatient,
} from "./schemas/patient";
import { createConsolidatedPatientData } from "../../command/medical/patient/create-consolidate-data";
import { bundleSchema } from "./schemas/fhir";
import { validateFhirEntries } from "../../external/fhir/shared/json-validator";

const router = Router();
const MAX_RESOURCE_POST_LIMIT = 50;
const MAX_RESOURCE_STORED_LIMIT = 1000;
const MAX_CONTENT_LENGTH = 1000000;

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
    const facilityId = getFromQueryOrFail("facilityId", req);
    const payload = patientUpdateSchema.parse(req.body);

    const isProcessing = await areDocumentsProcessing({ id, cxId });
    if (isProcessing) {
      return res.status(status.LOCKED).json("Document querying currently in progress");
    }

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
    const facilityId = getFromQueryOrFail("facilityId", req);

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

const resourceSchema = z.enum(resourceTypeForConsolidation).array();

/** ---------------------------------------------------------------------------
 * GET /patient/:id/consolidated
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
    const resourcesRaw = getFrom("query").optional("resources", req);
    const resources = resourcesRaw
      ? resourceSchema.parse(resourcesRaw.split(",").map(r => r.trim()))
      : undefined;
    const dateFrom = parseISODate(getFrom("query").optional("dateFrom", req));
    const dateTo = parseISODate(getFrom("query").optional("dateTo", req));

    const data = await getConsolidatedPatientData({ cxId, patientId, resources, dateFrom, dateTo });

    return res.json(data);
  })
);

/** ---------------------------------------------------------------------------
 * POST /patient/:id/consolidated
 *
 * Returns a Bundle with the outcome of the query.
 *
 * @param req.cxId The customer ID.
 * @param req.param.id The ID of the patient to associate resources to.
 * @param req.body The FHIR Bundle to create resources.
 * @return FHIR Bundle with operation outcome.
 */
router.post(
  "/:id/consolidated",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFrom("params").orFail("id", req);
    const fhirBundle = bundleSchema.parse(req.body);
    const patient = await getPatientOrFail({ id: patientId, cxId });
    const validatedBundle = validateFhirEntries(fhirBundle);

    if (Config.isSandbox()) {
      const data = await getConsolidatedPatientData({ cxId, patientId });
      // limit the amount of resources stored in sandbox mode
      if (data.entry && data.entry.length >= MAX_RESOURCE_STORED_LIMIT) {
        return res.status(status.BAD_REQUEST).json({
          message: `Cannot create bundle with size greater than ${MAX_RESOURCE_STORED_LIMIT} bytes in Sandbox mode!`,
        });
      }
    }

    // Limit the amount of resources that can be created at once
    if (validatedBundle.entry.length >= MAX_RESOURCE_POST_LIMIT) {
      return res.status(status.BAD_REQUEST).json({
        message: `Cannot create more than ${MAX_RESOURCE_POST_LIMIT} resources at a time!`,
      });
    }

    const contentLength = req.headers["content-length"];
    // limit the payload size that can be created
    if (contentLength && parseInt(contentLength) >= MAX_CONTENT_LENGTH) {
      return res.status(status.BAD_REQUEST).json({
        message: `Cannot create bundle with size greater than ${MAX_CONTENT_LENGTH} bytes!`,
      });
    }

    const data = await createConsolidatedPatientData({
      cxId,
      patientId: patient.id,
      fhirBundle: validatedBundle,
    });

    return res.json(data);
  })
);

export default router;
