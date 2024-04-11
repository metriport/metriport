import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { z } from "zod";
import { getHieOverview } from "../../command/medical/admin/hie-overview";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler } from "../util";

dayjs.extend(duration);

const router = Router();

const debugLevelSchema = z.enum(["info", "success", "error"]).optional();

/**
 * GET /internal/hie/patient/overview
 *
 * Retrieves the overall status of a patient across HIEs.
 *
 * @param req.query.patientId - The patient's ID.
 * @param req.query.debugLevel - The level of details to include in the overview:
 *    - info: Only the basic information about the patient's status in the HIEs (default).
 *    - success: Include the successful responses from HIEs (useful to enhance the Patient's demographics).
 *    - error: Include the failed transactions in the overview (useful to diagnose why the patient didn't
 *              get linked to a certain external gateway).
 */
router.get(
  "/patient/overview",
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = getUUIDFrom("query", req, "patientId").orFail();
    const debugLevel = debugLevelSchema.parse(req.query.debugLevel) ?? "info";
    const response = await getHieOverview(patientId, debugLevel);
    return res.status(httpStatus.OK).json(response);
  })
);

export default router;
