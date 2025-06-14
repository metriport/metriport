import { isResourceDiffBundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { BadRequestError, isValidJobEntryStatus } from "@metriport/shared";
import { isEhrSource } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { setPatientJobEntryStatus } from "../../../command/job/patient/update/set-entry-status";
import {
  getLatestResourceDiffBundlesJobPayload,
  getResourceDiffBundlesJobPayload,
} from "../../../external/ehr/shared/job/bundle/create-resource-diff-bundles/get-job-payload";
import { startCreateResourceDiffBundlesJob } from "../../../external/ehr/shared/job/bundle/create-resource-diff-bundles/start-job";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /internal/ehr/:ehrId/patient/:id/resource/diff
 *
 * Starts the resource diff job to generate the resource diff bundles.
 *
 * @param req.query.ehrId - The EHR source.
 * @param req.query.cxId - The CX ID of the patient.
 * @param req.params.id - The patient id of the EHR patient.
 * @param req.query.practiceId - The practice id of the EHR patient.
 * @returns The job ID of the resource diff job
 */
router.post(
  "/:id/resource/diff",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("id", req);
    const practiceId = getFromQueryOrFail("practiceId", req);
    const jobId = await startCreateResourceDiffBundlesJob({
      ehr,
      cxId,
      ehrPatientId: patientId,
      practiceId,
    });
    return res.status(httpStatus.OK).json(jobId);
  })
);

/**
 * GET /internal/ehr/:ehrId/patient/:id/resource/diff/latest
 *
 * Retrieves the latest resource diff job and pre-signed URLs for the resource diff bundles if completed
 *
 * @param req.query.ehrId - The EHR source.
 * @param req.query.cxId - The CX ID of the patient.
 * @param req.params.id - The patient id of the EHR patient.
 * @param req.query.bundleType - The type of bundle to fetch.
 * @returns Resource diff job and pre-signed URLs for the bundles if completed
 */
router.get(
  "/:id/resource/diff/latest",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("id", req);
    const bundleType = getFromQueryOrFail("bundleType", req);
    if (!isResourceDiffBundleType(bundleType)) {
      throw new BadRequestError("Invalid bundle type", undefined, {
        bundleType,
      });
    }
    const bundle = await getLatestResourceDiffBundlesJobPayload({
      ehr,
      cxId,
      ehrPatientId: patientId,
      bundleType,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

/**
 * GET /internal/ehr/:ehrId/patient/:id/resource/diff/:jobId
 *
 * Retrieves the resource diff job by job id and pre-signed URLs for the resource diff bundles if completed
 *
 * @param req.query.ehrId - The EHR source.
 * @param req.query.cxId - The CX ID of the patient.
 * @param req.params.id - The patient id of the EHR patient.
 * @param req.query.bundleType - The type of bundle to fetch.
 * @param req.params.jobId - The job ID of the resource diff job.
 * @returns Resource diff job and pre-signed URLs for the bundles if completed
 */
router.get(
  "/:id/resource/diff/:jobId",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("params").orFail("id", req);
    const bundleType = getFromQueryOrFail("bundleType", req);
    if (!isResourceDiffBundleType(bundleType)) {
      throw new BadRequestError("Invalid bundle type", undefined, {
        bundleType,
      });
    }
    const jobId = getFrom("params").orFail("jobId", req);
    const bundle = await getResourceDiffBundlesJobPayload({
      ehr,
      cxId,
      ehrPatientId: patientId,
      bundleType,
      jobId,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

/**
 * POST /internal/ehr/:ehrId/patient/:id/resource/diff/set-entry-status
 *
 * Sets the status of a resource diff job entry.
 *
 * @param req.query.ehrId - The EHR source.
 * @param req.query.cxId - The CX ID of the patient.
 * @param req.params.id - The patient id of the EHR patient.
 * @param req.query.jobId - The job ID.
 * @param req.query.entryStatus - The status of the entry.
 * @returns 200 OK
 */
router.post(
  "/:id/resource/diff/set-entry-status",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const jobId = getFromQueryOrFail("jobId", req);
    const entryStatus = getFromQueryOrFail("entryStatus", req);
    if (!isValidJobEntryStatus(entryStatus)) {
      throw new BadRequestError("Status must a valid job entry status");
    }
    await setPatientJobEntryStatus({
      jobId,
      cxId,
      entryStatus,
      onCompleted: async () => {
        //TODO: Contribute EHR-only bundles
      },
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
