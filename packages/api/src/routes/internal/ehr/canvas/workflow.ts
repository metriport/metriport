import { isValidEntryStatus } from "@metriport/shared/dist/domain/workflow/types";
import { BadRequestError } from "@metriport/shared/dist/error/bad-request";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { updateWorkflowTotals } from "../../../../command/workflow/update-total";
import { updateWorkflowTracking } from "../../../../command/workflow/update-tracking";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler, getFromQueryOrFail } from "../../../util";

const router = Router();

/**
 * POST /internal/ehr/canvas/workflow/update-total
 *
 * Updates the total number of resources to process.
 * @param req.query.cxId The CX ID.
 * @param req.query.patientId The patient ID.
 * @param req.query.workflowId The workflow ID.
 * @param req.query.requestId The request ID.
 * @param req.query.total The total number of resources to process.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFromQueryOrFail("patientId", req);
    const workflowId = getFromQueryOrFail("workflowId", req);
    const requestId = getFromQueryOrFail("requestId", req);
    const status = getFromQueryOrFail("status", req);
    if (!isValidEntryStatus(status)) {
      throw new BadRequestError("Status must be either successful or failed");
    }
    await updateWorkflowTotals({
      cxId,
      patientId,
      workflowId,
      requestId,
      status,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/canvas/workflow/update-tracking
 *
 * Updates the tracking of the workflow.
 * @param req.query.cxId The CX ID.
 * @param req.query.patientId The patient ID.
 * @param req.query.workflowId The workflow ID.
 * @param req.query.requestId The request ID.
 * @param req.query.total The total number of resources to process.
 */
router.post(
  "/update-tracking",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFromQueryOrFail("patientId", req);
    const workflowId = getFromQueryOrFail("workflowId", req);
    const requestId = getFromQueryOrFail("requestId", req);
    const total = getFromQueryOrFail("total", req);
    await updateWorkflowTracking({
      cxId,
      patientId,
      facilityId: undefined,
      workflowId,
      requestId,
      total: +total,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
