import { BadRequestError } from "@metriport/shared";
import { isResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { processAsyncError } from "../../../errors";
import { createResourceDiffBundles } from "../../../external/ehr/canvas/command/bundle/create-resource-diff-bundles";
import { fetchResourceDiffBundle } from "../../../external/ehr/canvas/command/bundle/fetch-resource-diff-bundle";
import { syncCanvasPatientIntoMetriport } from "../../../external/ehr/canvas/command/sync-patient";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * GET /ehr/canvas/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Canvas Patient.
 * @param req.query.practiceId The ID of Canvas Practice.
 * @returns Metriport Patient if found.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncCanvasPatientIntoMetriport({
      cxId,
      canvasPracticeId,
      canvasPatientId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/**
 * POST /ehr/canvas/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Canvas Patient.
 * @param req.query.practiceId The ID of Canvas Practice.
 * @returns Metriport Patient if found.
 */
router.post(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const patientId = await syncCanvasPatientIntoMetriport({
      cxId,
      canvasPracticeId,
      canvasPatientId,
    });
    return res.status(httpStatus.OK).json(patientId);
  })
);

/**
 * POST /ehr/canvas/patient/:id/resource-diff-bundle
 *
 * Starts the resource diff workflow to generate the Metriport only bundle, or Canvas only bundle.
 * The workflow is started asynchronously.
 * @param req.params.id The ID of Canvas Patient.
 * @param req.query.practiceId The ID of Canvas Practice.
 * @param req.query.direction The direction of the resource diff bundles to create.
 * @returns 200 OK
 */
router.post(
  "/:id/resource-diff-bundle",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const direction = getFromQueryOrFail("direction", req);
    if (!isResourceDiffDirection(direction)) {
      throw new BadRequestError("Invalid direction", undefined, {
        direction,
      });
    }
    createResourceDiffBundles({
      cxId,
      canvasPatientId,
      canvasPracticeId,
      direction,
    }).catch(processAsyncError("Canvas createResourceDiffBundles"));
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /ehr/canvas/patient/:id/resource-diff-bundle
 *
 * Retrieves the Metriport only bundle, or Canvas only bundle, for all supported resource types.
 * @param req.params.id The ID of Canvas Patient.
 * @param req.query.practiceId The ID of Canvas Practice.
 * @param req.query.direction The direction of the resource diff bundles to fetch.
 * @returns Metriport only bundle or Canvas only bundle
 */
router.get(
  "/:id/resource-diff-bundle",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const direction = getFromQueryOrFail("direction", req);
    if (!isResourceDiffDirection(direction)) {
      throw new BadRequestError("Invalid direction", undefined, {
        direction,
      });
    }
    const bundle = await fetchResourceDiffBundle({
      cxId,
      canvasPatientId,
      canvasPracticeId,
      direction,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

export default router;
