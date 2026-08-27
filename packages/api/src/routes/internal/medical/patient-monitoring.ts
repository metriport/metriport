import { patientMonitoringCadenceSchema } from "@metriport/shared/domain/patient/patient-monitoring/utils";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { z } from "zod";
import { runPatientMonitoringScheduledQueries } from "../../../command/medical/patient-monitoring/run-scheduled-queries";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler } from "../../util";

const router = Router();

const patientMonitoringScheduledQueriesSchema = z.object({
  forceCadences: z.array(patientMonitoringCadenceSchema).min(1).optional(),
  forceCxIds: z.array(z.string()).min(1).optional(),
});

/** ---------------------------------------------------------------------------
 * POST /internal/patient-monitoring/scheduled-queries
 *
 * Runs the scheduled patient monitoring queries for each customer with the specified cadence.
 *
 * This endpoint is triggered by a scheduled lambda on a weekly basis.
 *
 * @param forceCadences - Optional array of cadences to run instead of calculating based on date.
 *                           Use this to re-run specific cadences on non-Saturday days (e.g., after an outage).
 *                           Valid values: "weekly", "biweekly", "monthly"
 * @param forceCxIds - Optional array of customer IDs to run monitoring for instead of all customers with cohorts.
 * @returns Summary of patient monitoring job execution
 */
router.post(
  "/scheduled-queries",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { forceCadences, forceCxIds } = patientMonitoringScheduledQueriesSchema.parse(req.body);
    const results = await runPatientMonitoringScheduledQueries({ forceCadences, forceCxIds });
    return res.status(httpStatus.OK).json(results);
  })
);

export default router;
