import {
  BadRequestError,
  isValidJobEntryStatus,
  isValidJobStatus,
  JobStatus,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { z } from "zod";
import { getPatientJobByIdOrFail, getPatientJobs } from "../../../command/job/patient/get";
import { startJobs } from "../../../command/job/patient/scheduler/start-jobs";
import { cancelPatientJob } from "../../../command/job/patient/status/cancel";
import { completePatientJob } from "../../../command/job/patient/status/complete";
import { failPatientJob } from "../../../command/job/patient/status/fail";
import { initializePatientJob } from "../../../command/job/patient/status/initialize";
import { setPatientJobEntryStatus } from "../../../command/job/patient/update/set-entry-status";
import { updatePatientJobRuntimeData } from "../../../command/job/patient/update/update-runtime-data";
import { updatePatientJobTotal } from "../../../command/job/patient/update/update-total";
import { parseISODate } from "../../../shared/date";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler, getFrom, getFromQuery, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * GET /internal/patient/job
 *
 * Gets the jobs matching the filters.
 * @param req.query.cxId - The CX ID.
 * @param req.query.patientId - The patient ID. Optional.
 * @param req.query.jobType - The job type. Optional.
 * @param req.query.jobGroupId - The job group ID. Optional.
 * @param req.query.status - The status of the job. Optional.
 * @param req.query.scheduledAfter - The scheduled after date.
 * @param req.query.scheduledBefore - The scheduled before date.
 * @returns 200 OK
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQuery("cxId", req);
    const patientId = getFromQuery("patientId", req);
    const jobType = getFromQuery("jobType", req);
    const jobGroupId = getFromQuery("jobGroupId", req);
    const status = getFromQuery("status", req);
    const scheduledAfter = parseISODate(getFrom("query").optional("scheduledAfter", req));
    const scheduledBefore = parseISODate(getFrom("query").optional("scheduledBefore", req));
    if (scheduledAfter && scheduledBefore && scheduledAfter > scheduledBefore) {
      throw new BadRequestError("scheduledAfter must be earlier than or equal to scheduledBefore");
    }
    if (status && !isValidJobStatus(status)) {
      throw new BadRequestError("Status must be a valid job status");
    }
    const jobs = await getPatientJobs({
      cxId,
      patientId,
      jobType,
      jobGroupId,
      status: status as JobStatus,
      scheduledAfter: scheduledAfter ? buildDayjs(scheduledAfter).toDate() : undefined,
      scheduledBefore: scheduledBefore ? buildDayjs(scheduledBefore).toDate() : undefined,
    });
    return res.status(httpStatus.OK).json({ jobs });
  })
);

/**
 * POST /internal/patient/job/scheduler/start
 *
 * Starts the jobs that are scheduled before the given date.
 * @param req.query.scheduledAtCutoff - The scheduled at cutoff date. Optional.
 * @param req.query.cxId - The CX ID. Optional.
 * @param req.query.patientId - The patient ID. Optional.
 * @param req.query.jobType - The job type. Optional.
 * @param req.query.status - The status of the job. Optional.
 * @param req.query.scheduledAfter - The scheduled after date.
 * @param req.query.scheduledBefore - The scheduled before date.
 * @returns 200 OK
 */
router.post(
  "/scheduler/start",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const scheduledBefore = parseISODate(getFrom("query").optional("scheduledBefore", req));
    const cxId = getFromQuery("cxId", req);
    const patientId = getFromQuery("patientId", req);
    const jobType = getFromQuery("jobType", req);
    const status = getFromQuery("status", req);
    if (status && !isValidJobStatus(status)) {
      throw new BadRequestError("Status must be a valid job status");
    }
    await startJobs({
      scheduledBefore: scheduledBefore ? buildDayjs(scheduledBefore).toDate() : undefined,
      cxId,
      patientId,
      jobType,
      status: status as JobStatus,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

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

const failOrCancelSchema = z.object({
  reason: z.string(),
});

/**
 * POST /internal/patient/job/:jobId/fail
 *
 * Fails the job.
 * @param req.query.cxId - The CX ID.
 * @param req.params.jobId - The job ID.
 * @param req.body.reason - The reason for failing the job.
 * @returns 200 OK
 */
router.post(
  "/:jobId/fail",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFrom("params").orFail("jobId", req);
    const { reason } = failOrCancelSchema.parse(req.body);
    await failPatientJob({ jobId, cxId, reason });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/patient/job/:jobId/cancel
 *
 * Cancels the job.
 * @param req.query.cxId - The CX ID.
 * @param req.params.jobId - The job ID.
 * @param req.body.reason - The reason for cancelling the job.
 * @returns 200 OK
 */
router.post(
  "/:jobId/cancel",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFrom("params").orFail("jobId", req);
    const { reason } = failOrCancelSchema.parse(req.body);
    await cancelPatientJob({ jobId, cxId, reason });
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
  "/:jobId/total",
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
 * GET /internal/patient/job/:jobId/runtime-data
 *
 * Gets the runtime data of the job.
 * @param req.query.cxId - The CX ID.
 * @param req.params.jobId - The job ID.
 * @returns The runtime data of the job.
 */
router.get(
  "/:jobId/runtime-data",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFrom("params").orFail("jobId", req);
    const job = await getPatientJobByIdOrFail({ jobId, cxId });
    return res.status(httpStatus.OK).json({ runtimeData: job.runtimeData });
  })
);

const updateRuntimeDataSchema = z.object({
  data: z.record(z.unknown()).optional(),
});

/**
 * POST /internal/patient/job/:jobId/runtime-data
 *
 * Updates or sets the runtime data of the job.
 * @param req.query.cxId - The CX ID.
 * @param req.params.jobId - The job ID.
 * @param req.body.data - The runtime data to update.
 * @returns The runtime data of the job.
 */
router.post(
  "/:jobId/runtime-data",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFrom("params").orFail("jobId", req);
    const { data } = updateRuntimeDataSchema.parse(req.body);
    const job = await updatePatientJobRuntimeData({
      jobId,
      cxId,
      data,
    });
    return res.status(httpStatus.OK).json({ runtimeData: job.runtimeData });
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
