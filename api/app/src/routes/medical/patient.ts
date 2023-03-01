import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createPatient } from "../../command/medical/patient/create-patient";
import { getPatients } from "../../command/medical/patient/get-patient";
import { updatePatient } from "../../command/medical/patient/update-patient";
import { Patient } from "../../models/medical/patient";
import { asyncHandler, getCxIdOrFail, getFacilityIdFromQueryOrFail } from "../util";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /patient
 *
 * Updates or creates the patient corresponding to the specified facility at the
 * customer's organization if it doesn't exist already.
 *
 * @return  {Patient}  The patient.
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityId = getFacilityIdFromQueryOrFail(req);

    // TODO: parse this into model
    const patientData = req.body;

    let patient: Patient;
    if (patientData.id) {
      const data = { ...patientData };
      delete data.id;
      delete data.facilityId;
      patient = await updatePatient({
        id: patientData.id,
        cxId,
        data,
      });
    } else {
      patient = await createPatient({
        cxId,
        data: patientData,
        facilityId: facilityId,
      });
    }

    // TODO: create or update patient in CW as well

    return res
      .status(status.OK)
      .json({ id: patient.id, facilityIds: patient.facilityIds, ...patient.data });
  })
);

/** ---------------------------------------------------------------------------
 * GET /patient
 *
 * Gets all of the patients corresponding to the specified facility at the
 * customer's organization.
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
