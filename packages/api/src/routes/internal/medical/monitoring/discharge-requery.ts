import { jobRunBodySchema } from "@metriport/shared/domain/job/types";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { createDischargeRequeryJob } from "../../../../command/medical/patient/patient-monitoring/discharge-requery/create";
import { runDischargeRequeryJob } from "../../../../command/medical/patient/patient-monitoring/discharge-requery/initialize";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler } from "../../../util";

const router = Router();

/**
 * POST /internal/patient/monitoring/job/discharge-requery
 *
 * Creates the discharge requery job.
 *
 * @param req.query.cxId - The CX ID.
 * @param req.query.patientId - The patient ID.
 * @param req.body - The discharge requery job parameters.
 * @returns 200 OK
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getUUIDFrom("query", req, "patientId").orFail();
    const job = await createDischargeRequeryJob({ cxId, patientId });

    return res.status(httpStatus.OK).json(job);
  })
);

/**
 * POST /internal/patient/monitoring/job/discharge-requery/run
 *
 * Runs the discharge requery job.
 *
 * @param req.body.cxId - The CX ID.
 * @param req.body.jobId - The job ID.
 * @returns 200 OK
 */
router.post(
  "/run",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, jobId } = jobRunBodySchema.parse(req.body);
    await runDischargeRequeryJob({ cxId, jobId });

    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
