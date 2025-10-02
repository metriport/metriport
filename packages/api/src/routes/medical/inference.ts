import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { z } from "zod";
import { handleParams } from "../helpers/handle-params";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getCxIdOrFail } from "../util";

const router = Router();

const sidePanelInferenceSchema = z.object({
  context: z.string(),
});

/** ---------------------------------------------------------------------------
 * POST /internal/inference/side-panel
 *
 * Creates or updates a feedback (group of multiple feedback entries).
 */
router.post(
  "/side-panel",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const { context } = sidePanelInferenceSchema.parse(req.body);
    console.log(`context: ${context}, cxId: ${cxId}`);
    const message = "Hello, world!";
    return res.status(status.OK).json({ message });
  })
);

export default router;
