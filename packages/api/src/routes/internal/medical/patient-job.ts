import { BadRequestError, isValidJobEntryStatus } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { completePatientJob } from "../../../command/job/patient/complete";
import { initializePatientJob } from "../../../command/job/patient/initialize";
import { setPatientJobEntryStatus } from "../../../command/job/patient/set-entry-status";
import { updatePatientJobTotal } from "../../../command/job/patient/update-total";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /internal/patient/job/:jobId/initialize
 *
 * Initializes the job.
 * @param req.query.cxId - The CX ID.
 * @param req.params.jobId - The job ID.
 * @returns 200 OK
 */
router.post(
  "/:jobId/initialize",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFrom("params").orFail("jobId", req);
    await initializePatientJob({ jobId, cxId });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/patient/job/:jobId/complete
 *
 * Completes the job. Should only be used when the job has no entries to process. Otherwise, use
 * POST /internal/patient/job/:jobId/set-entry-status to set the status of the job entry.
 * @param req.query.cxId - The CX ID.
 * @param req.params.jobId - The job ID.
 * @returns 200 OK
 */
router.post(
  "/:jobId/complete",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFrom("params").orFail("jobId", req);
    await completePatientJob({ jobId, cxId });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/patient/job/:jobId/update-total
 *
 * Updates the total of the job.
 * @param req.query.cxId - The CX ID.
 * @param req.params.jobId - The job ID.
 * @param req.query.total - The total number of entries to process.
 * @returns 200 OK
 */
router.post(
  "/:jobId/update-total",
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
 * POST /internal/patient/job/:jobId/set-entry-status
 *
 * Sets the status of a patient job entry.
 * @param req.query.cxId - The CX ID.
 * @param req.params.jobId - The job ID.
 * @param req.query.entryStatus - The status of the entry.
 * @returns 200 OK
 */
router.post(
  "/:jobId/set-entry-status",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFrom("params").orFail("jobId", req);
    const entryStatus = getFromQueryOrFail("entryStatus", req);
    if (!isValidJobEntryStatus(entryStatus)) {
      throw new BadRequestError("Status must a valid job entry status");
    }
    await setPatientJobEntryStatus({
      jobId,
      cxId,
      entryStatus,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
