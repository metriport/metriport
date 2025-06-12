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
import { getPatientJobs } from "../../../command/job/patient/get";
import { startJobs } from "../../../command/job/patient/scheduler/start-jobs";
import { cancelPatientJob } from "../../../command/job/patient/status/cancel";
import { completePatientJob } from "../../../command/job/patient/status/complete";
import { failPatientJob } from "../../../command/job/patient/status/fail";
import { initializePatientJob } from "../../../command/job/patient/status/initialize";
import { setPatientJobEntryStatus } from "../../../command/job/patient/update/set-entry-status";
import { updatePatientJobRuntimeData } from "../../../command/job/patient/update/update-runtime-data";
import { updatePatientJobTotal } from "../../../command/job/patient/update/update-total";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler, getFrom, getFromQuery, getFromQueryOrFail } from "../../util";
import patientJobsRouter from "./patient-jobs";

const router = Router();

router.use("/", patientJobsRouter);

/**
 * GET /internal/patient/job
 *
 * Gets the jobs that with filters
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
    const cxId = getFromQueryOrFail("cxId", req);
    const patientId = getFromQuery("patientId", req);
    const jobType = getFromQuery("jobType", req);
    const jobGroupId = getFromQuery("jobGroupId", req);
    const status = getFromQuery("status", req);
    const scheduledAfter = getFromQuery("scheduledAfter", req);
    const scheduledBefore = getFromQuery("scheduledBefore", req);
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
 * @param req.query.runDate - The run date. Optional.
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
    const runDate = getFromQuery("runDate", req);
    const runDateDate = runDate ? buildDayjs(runDate).toDate() : undefined;
    const cxId = getFromQuery("cxId", req);
    const patientId = getFromQuery("patientId", req);
    const jobType = getFromQuery("jobType", req);
    const status = getFromQuery("status", req);
    if (status && !isValidJobStatus(status)) {
      throw new BadRequestError("Status must be a valid job status");
    }
    await startJobs({
      runDate: runDateDate,
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

const updateRuntimeDataSchema = z.object({
  data: z.record(z.unknown()).optional(),
});

/**
 * POST /internal/patient/job/:jobId/update-runtime-data
 *
 * Updates the runtime data of the job.
 * @param req.query.cxId - The CX ID.
 * @param req.params.jobId - The job ID.
 * @param req.body.data - The runtime data to update.
 * @returns 200 OK
 */
router.post(
  "/:jobId/update-runtime-data",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFrom("params").orFail("jobId", req);
    const { data } = updateRuntimeDataSchema.parse(req.body);
    await updatePatientJobRuntimeData({
      jobId,
      cxId,
      data,
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
