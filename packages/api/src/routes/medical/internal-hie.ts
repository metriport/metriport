import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared";
import httpStatus from "http-status";
import { z } from "zod";
import { getHieOverview } from "../../command/medical/admin/hie-overview";
import { requestLogger } from "../helpers/request-logger";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler, getFrom, getFromQueryAsBoolean } from "../util";
import { unlinkPatientFromOrganization } from "../../command/hie/unlink-patient-from-organization";

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
 * POST /internal/hie/unlink
 *
 * Unlinks a patient from a facility and removes all data associated with it.
 *
 * @param req.query.patientId - The patient's ID.
 * @param req.query.oid - The oid of the facility to unlink from.
 * @param req.query.dryRun - If true, will only simulate the unlink operation.
 */
router.post(
  "/unlink",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getUUIDFrom("query", req, "patientId").orFail();
    const oid = getFrom("query").orFail("oid", req);
    const dryRun = getFromQueryAsBoolean("dryRun", req);

    const { log } = out(`unlinkPatientFromOrganization - patient ${patientId} - cxId ${cxId}`);

    unlinkPatientFromOrganization({
      cxId,
      patientId,
      oid,
      dryRun,
    }).catch(err => {
      const msg = `Error unlinking patient from organization`;
      log(`Error unlinking patient from organization: ${errorToString(err)}`);
      capture.error(msg, { extra: { err, cxId, patientId, oid } });
    });

    return res.status(httpStatus.OK).json({
      processing: true,
      cxId,
      patientId,
      oid,
      dryRun,
    });
  })
);

export default router;
