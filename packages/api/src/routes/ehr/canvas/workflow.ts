import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { fetchCanvasMetriportOnlyBundle } from "../../../external/ehr/canvas/command/bundle/fetch-metriport-only-bundle";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * GET /ehr/canvas/workflow/:id/metriport-only-bundle
 *
 * Retrieves the metriport only bundle
 * @param req.params.id The ID of Canvas Workflow.
 * @returns Metriport only bundle
 */
router.get(
  "/:id/metriport-only-bundle",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const canvasPatientId = getFrom("params").orFail("id", req);
    const canvasPracticeId = getFromQueryOrFail("practiceId", req);
    const bundle = await fetchCanvasMetriportOnlyBundle({
      cxId,
      canvasPatientId,
      canvasPracticeId,
    });
    return res.status(httpStatus.OK).json(bundle);
  })
);

export default router;
