import {
  BadRequestError,
  isValidJobEntryStatus,
  isValidJobStatus,
  JobStatus,
} from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { updatePatientJobTotals } from "../../../command/job/patient/update-total";
import { updatePatientJobTracking } from "../../../command/job/patient/update-tracking";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler, getFromQuery, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /internal/job/patient/update-totals
 *
 * Updates the total number of resources to process.
 * @param req.query.cxId The CX ID.
 * @param req.query.jobId The job ID.
 * @param req.query.entryStatus The status of the entry.
 * @returns 200 OK
 */
router.post(
  "/update-totals",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFromQueryOrFail("jobId", req);
    const entryStatus = getFromQueryOrFail("entryStatus", req);
    if (!isValidJobEntryStatus(entryStatus)) {
      throw new BadRequestError("Status must be either successful or failed");
    }
    await updatePatientJobTotals({
      jobId,
      cxId,
      entryStatus,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/job/patient/update-tracking
 *
 * Updates the tracking of the job.
 * @param req.query.cxId The CX ID.
 * @param req.query.jobId The job ID.
 * @param req.query.status The status of the job. (optional)
 * @param req.query.total The total number of entries to process. (optional)
 * @returns 200 OK
 */
router.post(
  "/update-tracking",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFromQueryOrFail("jobId", req);
    const status = getFromQuery("status", req);
    const total = getFromQuery("total", req);
    if (status && !isValidJobStatus(status)) {
      throw new BadRequestError("Status must be either waiting, processing, or completed");
    }
    if (total && isNaN(+total)) {
      throw new BadRequestError("Total must be a number");
    }
    await updatePatientJobTracking({
      jobId,
      cxId,
      ...(status && { status: status as JobStatus }),
      ...(total && { total: +total }),
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
