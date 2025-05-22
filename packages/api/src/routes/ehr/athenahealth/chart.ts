import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { writeMedicationToChart } from "../../../external/ehr/athenahealth/command/write-back/medication";
import { writeConditionToChart } from "../../../external/ehr/athenahealth/command/write-back/condition";
import { writeVitalsToChart } from "../../../external/ehr/athenahealth/command/write-back/vitals";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";
import { handleParams } from "../../helpers/handle-params";

const router = Router();

/**
 * POST /ehr/athenahealth/chart/:id/medication
 *
 * Writes the medication to the patient's chart
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.query.practiceId The ID of AthenaHealth Practice.
 * @param req.query.departmentId The ID of AthenaHealth Department.
 * @param req.body The FHIR Resource payload
 * @returns Athena API response
 */
router.post(
  "/:id/medication",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    const payload = req.body; // TODO Parse body https://github.com/metriport/metriport-internal/issues/2170
    const medicationDetails = await writeMedicationToChart({
      cxId,
      athenaPatientId,
      athenaPracticeId,
      athenaDepartmentId,
      medication: payload,
    });
    return res.status(httpStatus.OK).json(medicationDetails);
  })
);

/**
 * POST /ehr/athenahealth/chart/:id/condition
 *
 * Writes the condition to the patient's chart
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.query.practiceId The ID of AthenaHealth Practice.
 * @param req.query.departmentId The ID of AthenaHealth Department.
 * @param req.body The FHIR Resource payload
 * @returns Athena API response
 */
router.post(
  "/:id/condition",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    const payload = req.body; // TODO Parse body https://github.com/metriport/metriport-internal/issues/2170
    const conditionDetails = await writeConditionToChart({
      cxId,
      athenaPatientId,
      athenaPracticeId,
      athenaDepartmentId,
      condition: payload,
    });
    return res.status(httpStatus.OK).json(conditionDetails);
  })
);

/**
 * POST /ehr/athenahealth/chart/:id/vitals
 *
 * Writes the vitals to the patient's chart
 * @param req.params.id The ID of AthenaHealth Patient.
 * @param req.query.practiceId The ID of AthenaHealth Practice.
 * @param req.query.departmentId The ID of AthenaHealth Department.
 * @param req.body The FHIR Resource payload
 * @returns Athena API response
 */
router.post(
  "/:id/vitals",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const athenaPatientId = getFrom("params").orFail("id", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    const payload = req.body; // TODO Parse body https://github.com/metriport/metriport-internal/issues/2170
    const vitalsDetails = await writeVitalsToChart({
      cxId,
      athenaPatientId,
      athenaPracticeId,
      athenaDepartmentId,
      vitals: payload,
    });
    return res.status(httpStatus.OK).json(vitalsDetails);
  })
);

export default router;
