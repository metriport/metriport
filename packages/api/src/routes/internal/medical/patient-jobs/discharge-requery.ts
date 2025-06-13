import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { createDischargeRequeryJob } from "../../../../domain/medical/monitoring/discharge-requery/create";
import { runDischargeRequeryJob } from "../../../../domain/medical/monitoring/discharge-requery/initialize";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler, getFrom } from "../../../util";

const router = Router();

/**
 * POST /internal/patient/job/discharge-requery/create
 *
 * Creates the discharge requery job.
 *
 * @param req.body - The discharge requery job parameters.
 * @returns 200 OK
 */
router.post(
  "/discharge-requery/create",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getUUIDFrom("query", req, "patientId").orFail();
    await createDischargeRequeryJob({ cxId, patientId });

    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/patient/job/discharge-requery/:jobId/run
 *
 * Runs the discharge requery job.
 * @param req.query.cxId - The CX ID.
 * @param req.params.jobId - The job ID.
 * @returns 200 OK
 */
router.post(
  "/discharge-requery/:jobId/run",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFrom("params").orFail("jobId", req);
    await runDischargeRequeryJob({ cxId, jobId });

    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
