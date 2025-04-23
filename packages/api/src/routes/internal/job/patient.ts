import { BadRequestError, isValidJobEntryStatus } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { initializePatientJob } from "../../../command/job/patient/initialize";
import { updatePatientJobCount } from "../../../command/job/patient/update-count";
import { updatePatientJobTotal } from "../../../command/job/patient/update-total";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /internal/job/patient/initialize/:jobId
 *
 * Initializes the job.
 * @param req.query.cxId The CX ID.
 * @param req.params.jobId The job ID.
 * @returns 200 OK
 */
router.post(
  "/initialize/:jobId",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFrom("params").orFail("jobId", req);
    await initializePatientJob({ jobId, cxId });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/job/patient/update-total/:jobId
 *
 * Updates the total of the job.
 * @param req.query.cxId The CX ID.
 * @param req.params.jobId The job ID.
 * @param req.query.total The total number of entries to process.
 * @returns 200 OK
 */
router.post(
  "/update-total/:jobId",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFrom("params").orFail("jobId", req);
    const total = getFromQueryOrFail("total", req);
    if (isNaN(+total)) {
      throw new BadRequestError("Total must be a number");
    }
    await updatePatientJobTotal({
      jobId,
      cxId,
      total: +total,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/job/patient/update-count/:jobId
 *
 * Updates the count of the job.
 * @param req.query.cxId The CX ID.
 * @param req.params.jobId The job ID.
 * @param req.query.entryStatus The status of the entry.
 * @returns 200 OK
 */
router.post(
  "/update-count/:jobId",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFrom("params").orFail("jobId", req);
    const entryStatus = getFromQueryOrFail("entryStatus", req);
    if (!isValidJobEntryStatus(entryStatus)) {
      throw new BadRequestError("Status must a valid job entry status");
    }
    await updatePatientJobCount({
      jobId,
      cxId,
      entryStatus,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
