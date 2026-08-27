import { isPlainAllergyIntolerance, isPlainCondition } from "@metriport/fhir-sdk";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { syncHealthiePatientIntoMetriport } from "../../../external/ehr/healthie/command/sync-patient";
import { writeAllergyToFhir } from "../../../external/ehr/healthie/command/write-back/allergy";
import { writeConditionToFhir } from "../../../external/ehr/healthie/command/write-back/condition";
import { writeMedicationToFhir } from "../../../external/ehr/healthie/command/write-back/medication";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";
import { processEhrPatientId } from "../shared";
import { tokenEhrPatientIdQueryParam } from "./auth/middleware";

const router = Router();

/**
 * GET /ehr/healthie/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Healthie Patient.
 * @param req.query.practiceId The ID of Healthie Practice.
 * @returns Metriport Patient ID if found.
 */
router.get(
  "/:id",
  handleParams,
  processEhrPatientId(tokenEhrPatientIdQueryParam, "params"),
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const healthiePatientId = getFrom("params").orFail("id", req);
    const healthiePracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncHealthiePatientIntoMetriport({
      cxId,
      healthiePracticeId,
      healthiePatientId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/**
 * POST /ehr/healthie/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Healthie Patient.
 * @param req.query.practiceId The ID of Healthie Practice.
 * @returns Metriport Patient ID if found.
 */
router.post(
  "/:id",
  handleParams,
  processEhrPatientId(tokenEhrPatientIdQueryParam, "params"),
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const healthiePatientId = getFrom("params").orFail("id", req);
    const healthiePracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncHealthiePatientIntoMetriport({
      cxId,
      healthiePracticeId,
      healthiePatientId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/**
 * POST /ehr/healthie/patient/:id/condition
 *
 * Creates a condition
 * @param req.params.id The ID of Healthie Patient.
 * @param req.query.practiceId The ID of Healthie Practice.
 * @param req.body The FHIR Condition Resource payload
 * @returns Healthie API response
 */
router.post(
  "/:id/condition",
  handleParams,
  processEhrPatientId(tokenEhrPatientIdQueryParam, "params"),
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const healthiePatientId = getFrom("params").orFail("id", req);
    const healthiePracticeId = getFromQueryOrFail("practiceId", req);
    const payload = req.body;
    if (!isPlainCondition(payload)) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ error: "Invalid condition payload @ healthie" });
    }
    await writeConditionToFhir({
      cxId,
      healthiePatientId,
      healthiePracticeId,
      condition: payload,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /ehr/healthie/patient/:id/allergy
 *
 * Creates an allergy
 * @param req.params.id The ID of Healthie Patient.
 * @param req.query.practiceId The ID of Healthie Practice.
 * @param req.body The FHIR AllergyIntolerance Resource payload
 * @returns Healthie API response
 */
router.post(
  "/:id/allergy",
  handleParams,
  processEhrPatientId(tokenEhrPatientIdQueryParam, "params"),
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const healthiePatientId = getFrom("params").orFail("id", req);
    const healthiePracticeId = getFromQueryOrFail("practiceId", req);
    const payload = req.body;
    if (!isPlainAllergyIntolerance(payload)) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ error: "Invalid allergy payload @ healthie" });
    }
    await writeAllergyToFhir({
      cxId,
      healthiePatientId,
      healthiePracticeId,
      allergyIntolerance: payload,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /ehr/healthie/patient/:id/medication
 *
 * Creates a medication
 * @param req.params.id The ID of Healthie Patient.
 * @param req.query.practiceId The ID of Healthie Practice.
 * @param req.body The FHIR MedicationStatement Resource payload
 * @returns Healthie API response
 */
router.post(
  "/:id/medication",
  handleParams,
  processEhrPatientId(tokenEhrPatientIdQueryParam, "params"),
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const healthiePatientId = getFrom("params").orFail("id", req);
    const healthiePracticeId = getFromQueryOrFail("practiceId", req);
    const payload = req.body; // TODO Parse body
    await writeMedicationToFhir({
      cxId,
      healthiePatientId,
      healthiePracticeId,
      medicationWithRefs: payload,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
