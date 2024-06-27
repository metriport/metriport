import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { z } from "zod";
import { getHieOverview } from "../../command/medical/admin/hie-overview";
import { getHieEnabledFFStatus } from "../../command/medical/admin/get-hie-enabled-feature-flags-status";
import { updateHieEnabledFFs } from "../../command/medical/admin/update-hie-enabled-feature-flags";
import { requestLogger } from "../helpers/request-logger";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler, getFrom, getFromQueryAsBoolean } from "../util";

dayjs.extend(duration);

const router = Router();

const debugLevelSchema = z.enum(["info", "success", "error"]).optional();

/**
 * GET /internal/hie/patient/overview
 *
 * Retrieves the overall status of a patient across HIEs.
 *
 * @param req.query.patientId - The patient's ID.
 * @param req.query.facilityId - The facility ID, optional. Only needed if the patient is
 *    associated with more than one facility and debugLevel is not "info".
 * @param req.query.debugLevel - The level of details to include in the overview (optional):
 *    - info: Only the basic information about the patient's status in the HIEs (default).
 *    - success: Include the successful responses from HIEs (useful to enhance the Patient's
 *               demographics).
 *    - error: Include the failed transactions in the overview (useful to diagnose why the patient
 *             didn't get linked to a certain external gateway).
 */
router.get(
  "/patient/overview",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = getUUIDFrom("query", req, "patientId").orFail();
    const facilityIdParam = getFrom("query").optional("facilityId", req);
    const debugLevel = debugLevelSchema.parse(req.query.debugLevel) ?? "info";
    const response = await getHieOverview(patientId, facilityIdParam, debugLevel);
    return res.status(httpStatus.OK).json(response);
  })
);

/**
 * GET /internal/hie/enabled
 *
 * Retrieves the customer status of enabled HIEs via the Feature Flags.
 *
 * @param req.query.cxId - The cutomer's ID.
 */
router.get(
  "/hie/enabled",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const response = await getHieEnabledFFStatus(cxId);
    return res.status(httpStatus.OK).json(response);
  })
);

/**
 * PUT /internal/hie/enabled
 *
 * Updates the customer status of enabled HIEs via the Feature Flags.
 *
 * @param req.query.cxId - The cutomer's ID.
 * @param req.query.cwEnabled - Whether to enabled CommonWell.
 * @param req.query.cqEnabled - Whether to enabled CareQuality.
 */
router.put(
  "/hie/enabled",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const cwEnabled = getFromQueryAsBoolean("cwEnabled", req);
    const cqEnabled = getFromQueryAsBoolean("cqEnabled", req);
    const response = await updateHieEnabledFFs({
      cxId,
      cwEnabled,
      cqEnabled,
    });
    return res.status(httpStatus.OK).json(response);
  })
);

export default router;
