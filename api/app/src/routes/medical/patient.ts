import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createPatient } from "../../command/medical/patient/create-patient";
import { getPatients } from "../../command/medical/patient/get-patient";
import { updatePatient } from "../../command/medical/patient/update-patient";
import { Patient, PatientData } from "../../models/medical/patient";
import { asyncHandler, getCxIdOrFail, getFacilityIdFromQueryOrFail } from "../util";
import { patientCreateSchema, patientUpdateSchema } from "./schemas/patient";

const router = Router();

type PatientDTO = Pick<Patient, "id" | "facilityIds"> & PatientData;

/** ---------------------------------------------------------------------------
 * POST /patient
 *
 * Creates the patient corresponding to the specified facility at the
 * customer's organization if it doesn't exist already.
 *
 * @param {string} facilityId The ID of the Facility the Patient should be associated with.
 *
 * @return {Patient} The newly created patient.
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityId = getFacilityIdFromQueryOrFail(req); // TODO needs this? If so, add to Doc ^

    const patientInput = patientCreateSchema.parse(req.body);

    const patient = await createPatient({
      ...patientInput,
      cxId,
      facilityId: facilityId,
      address: {
        ...patientInput.address,
        addressLine2: patientInput.address.addressLine2 ?? null,
      },
    });

    // TODO declarative, event-based integration: https://github.com/metriport/metriport-internal/issues/393
    // Intentionally asynchronous - it takes too long to perform
    // cwCommands.patient.createOrUpdate(patient).then(success => {
    //   // update the patient with the ID from CW
    // }, err => {
    //   // TODO #156 Send this to Sentry
    //   console.error(`Failed to createOrUpdate patient ${patient.id} @ Commonwell: `, err);
    // });

    const responsePayload: PatientDTO = {
      ...patient.data,
      id: patient.id,
      facilityIds: patient.facilityIds,
    };
    return res.status(status.OK).json(responsePayload);
  })
);

/** ---------------------------------------------------------------------------
 * PUT /patient/:id
 *
 * Updates the patient corresponding to the specified facility at the customer's organization.
 * Note: this is not a PATCH, so requests must include all patient data in the payload.
 *
 * @return  {Patient} The patient to be updated
 */
router.put(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);

    const patientInput = patientUpdateSchema.parse(req.body);

    const patient = await updatePatient({
      ...patientInput,
      cxId,
      address: {
        ...patientInput.address,
        addressLine2: patientInput.address.addressLine2 ?? null,
      },
    });

    // // TODO declarative, event-based integration: https://github.com/metriport/metriport-internal/issues/393
    // // Intentionally asynchronous - it takes too long to perform
    // cwCommands.patient.createOrUpdate(patient).then(undefined, err => {
    //   // TODO #156 Send this to Sentry
    //   console.error(`Failed to createOrUpdate patient ${patient.id} @ Commonwell: `, err);
    // });

    const responsePayload: PatientDTO = {
      ...patient.data,
      id: patient.id,
      facilityIds: patient.facilityIds,
    };
    return res.status(status.OK).json(responsePayload);
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
 * @return  {Patient[]} The customer's patients associated with the given facility.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityId = getFacilityIdFromQueryOrFail(req);
    const patients = await getPatients({ cxId, facilityId: facilityId });
    const patientsData = patients.map(patient => {
      return { id: patient.id, facilityIds: patient.facilityIds, ...patient.data };
    });

    return res.status(status.OK).json({ patients: patientsData });
  })
);

export default router;
