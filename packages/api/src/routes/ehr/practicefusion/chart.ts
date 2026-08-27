import { isPlainAllergyIntolerance, isPlainCondition } from "@metriport/fhir-sdk";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { writeAllergyToFhir } from "../../../external/ehr/practicefusion/command/write-back/allergy";
import { writeConditionToFhir } from "../../../external/ehr/practicefusion/command/write-back/condition";
import { writeMedicationToFhir } from "../../../external/ehr/practicefusion/command/write-back/medication";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /ehr/practicefusion/chart/:id/condition
 *
 * Writes the condition to the patient's chart
 * @param req.params.id The ID of PracticeFusion Patient.
 * @param req.query.practiceId The ID of PracticeFusion Practice.
 * @param req.body The FHIR Condition Resource payload
 * @returns PracticeFusion API response
 */
router.post(
  "/:id/condition",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const practicefusionPatientId = getFrom("params").orFail("id", req);
    const practicefusionPracticeId = getFromQueryOrFail("practiceId", req);
    const payload = req.body;
    if (!isPlainCondition(payload)) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ error: "Invalid condition payload @ practicefusion" });
    }
    await writeConditionToFhir({
      cxId,
      practicefusionPatientId,
      practicefusionPracticeId,
      condition: payload,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /ehr/practicefusion/chart/:id/allergy
 *
 * Writes the allergy to the patient's chart
 * @param req.params.id The ID of PracticeFusion Patient.
 * @param req.query.practiceId The ID of PracticeFusion Practice.
 * @param req.body The FHIR AllergyIntolerance Resource payload
 * @returns PracticeFusion API response
 */
router.post(
  "/:id/allergy",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const practicefusionPatientId = getFrom("params").orFail("id", req);
    const practicefusionPracticeId = getFromQueryOrFail("practiceId", req);
    const payload = req.body;
    if (!isPlainAllergyIntolerance(payload)) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ error: "Invalid allergy payload @ practicefusion" });
    }
    await writeAllergyToFhir({
      cxId,
      practicefusionPatientId,
      practicefusionPracticeId,
      allergyIntolerance: payload,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /ehr/practicefusion/chart/:id/medication
 *
 * Writes the medication to the patient's chart
 * @param req.params.id The ID of PracticeFusion Patient.
 * @param req.query.practiceId The ID of PracticeFusion Practice.
 * @param req.body The MedicationWithRefs payload
 * @returns PracticeFusion API response
 */
router.post(
  "/:id/medication",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const practicefusionPatientId = getFrom("params").orFail("id", req);
    const practicefusionPracticeId = getFromQueryOrFail("practiceId", req);
    const payload = req.body;
    await writeMedicationToFhir({
      cxId,
      practicefusionPatientId,
      practicefusionPracticeId,
      medicationWithRefs: payload,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
