import { demographicsSchema } from "@metriport/api-sdk";
import { stringToBoolean } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { getPatientOrFail, matchPatient } from "../../command/medical/patient/get-patient";
import NotFoundError from "../../errors/not-found";
import { Config } from "../../shared/config";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom } from "../util";
import { dtoFromModel } from "./dtos/patientDTO";
import { schemaDemographicsToPatientData } from "./schemas/patient";

import { patientCreateSchema } from "@metriport/api-sdk";
import { createPatient, PatientCreateCmd } from "../../command/medical/patient/create-patient";
import { getPatients } from "../../command/medical/patient/get-patient";
import { getSandboxPatientLimitForCx } from "../../domain/medical/get-patient-limit";
import { PatientModel as Patient } from "../../models/medical/patient";
import { getFromQueryOrFail } from "../util";
import { schemaCreateToPatientData } from "./schemas/patient";

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
      // Authorization
      await getPatientOrFail({ cxId, id: patient.id });
      return res.status(status.OK).json(dtoFromModel(patient));
    }
    throw new NotFoundError("Cannot find patient");
  })
);

export default router;
