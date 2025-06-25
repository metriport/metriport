import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { createDischargeRequeryJob } from "../../../../command/medical/patient/patient-monitoring/discharge-requery/create";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler } from "../../../util";

const router = Router();

/**
 * POST /internal/patient/monitoring/discharge-requery
 *
 * Creates the discharge requery job.
 *
 * @param req.query.cxId - The CX ID.
 * @param req.query.patientId - The patient ID.
 * @returns 200 OK
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getUUIDFrom("query", req, "patientId").orFail();
    const job = await createDischargeRequeryJob({ cxId, patientId });

    return res.status(httpStatus.OK).json({ job });
  })
);

export default router;
