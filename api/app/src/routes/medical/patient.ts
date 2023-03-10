import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createPatient } from "../../command/medical/patient/create-patient";
import { getPatient, getPatients } from "../../command/medical/patient/get-patient";
import { updatePatient } from "../../command/medical/patient/update-patient";
import cwCommands from "../../external/commonwell";
import { asyncHandler, getCxIdOrFail, getFromParamsOrFail, getFromQueryOrFail } from "../util";
import { dtoFromModel } from "./dtos/patientDTO";
import {
  patientCreateSchema,
  patientUpdateSchema,
  schemaToPatientCreate,
  schemaToPatientUpdate,
} from "./schemas/patient";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /patient
 *
 * Creates the patient corresponding to the specified facility at the
 * customer's organization if it doesn't exist already.
 *
 * @param {string} facilityId The ID of the Facility the Patient should be associated with.
 *
 * @return {PatientDTO} The newly created patient.
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityId = getFromQueryOrFail("facilityId", req);

    const input = patientCreateSchema.parse(req.body);
    const patientCreate = schemaToPatientCreate(input, cxId, facilityId);

    const patient = await createPatient(patientCreate);

    // TODO declarative, event-based integration: https://github.com/metriport/metriport-internal/issues/393
    // Intentionally asynchronous - it takes too long to perform
    cwCommands.patient.create(patient, facilityId).then(undefined, (err: unknown) => {
      // TODO #156 Send this to Sentry
      console.error(`Failure while creating patient ${patient.id} @ CW: `, err);
    });

    return res.status(status.OK).json(dtoFromModel(patient));
  })
);

/** ---------------------------------------------------------------------------
 * PUT /patient/:id
 *
 * Updates the patient corresponding to the specified facility at the customer's organization.
 * Note: this is not a PATCH, so requests must include all patient data in the payload.
 *
 * @param  {string} req.query.facilityId The ID of the facility the user patient
 *
 * @return {PatientDTO} The patient to be updated
 */
router.put(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityId = getFromQueryOrFail("facilityId", req);

    const input = patientUpdateSchema.parse({
      ...req.body,
      id: getFromParamsOrFail("id", req),
    });
    const patientUpdate = schemaToPatientUpdate(input, cxId);

    const patient = await updatePatient(patientUpdate);

    // TODO declarative, event-based integration: https://github.com/metriport/metriport-internal/issues/393
    // Intentionally asynchronous - it takes too long to perform
    cwCommands.patient.update(patient, facilityId).then(undefined, err => {
      // TODO #156 Send this to Sentry
      console.error(`Failed to update patient ${patient.id} @ CW: `, err);
    });

    return res.status(status.OK).json(dtoFromModel(patient));
  })
);

/** ---------------------------------------------------------------------------
 * GET /patient:id
 *
 * Returns a patient corresponding to the specified facility at the customer's organization.
 *
 * @param   {string}  req.cxId      The customer ID.
 * @param   {string}  req.param.id  The ID of the patient to be returned
 * is associated with.
 *
 * @return  {PatientDTO[]} The customer's patients associated with the given facility.
 */
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromParamsOrFail("id", req);
    const patient = await getPatient({ id: patientId, cxId });
    return res.status(status.OK).json(dtoFromModel(patient));
  })
);

/** ---------------------------------------------------------------------------
 * GET /patient
 *
 * Gets all patients corresponding to the specified facility at the customer's organization.
 *
 * @param   {string}        req.cxId              The customer ID.
 * @param   {string}        req.query.facilityId  The ID of the facility the user patient
 * is associated with.
 *
 * @return  {PatientDTO[]} The customer's patients associated with the given facility.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityId = getFromQueryOrFail("facilityId", req);
    const patients = await getPatients({ cxId, facilityId: facilityId });
    const patientsData = patients.map(dtoFromModel);
    return res.status(status.OK).json({ patients: patientsData });
  })
);

export default router;
