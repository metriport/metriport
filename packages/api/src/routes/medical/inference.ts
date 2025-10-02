import { uuidv7 } from "@metriport/shared/util";
import { createSession } from "better-sse";
import { Request, Response } from "express";
import Router from "express-promise-router";
import { z } from "zod";
import { handleParams } from "../helpers/handle-params";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler } from "../util";

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
    // const cxId = getCxIdOrFail(req);
    const { context } = sidePanelInferenceSchema.parse(req.body);
    const sse = await createSession(req, res, {
      state: {
        id: uuidv7(),
        name: "Side Panel Inference",
        description: "Side Panel Inference",
        startTimeMillis: Date.now().toString(),
        endTimeMillis: Date.now().toString(),
      },
    });

    sse.push({
      message: "Hello, world! Waiting 2 seconds...",
      eventName: "side-panel-hw",
      eventId: uuidv7(),
    });

    await new Promise(function (resolve) {
      setTimeout(resolve, 2000);
    });

    sse.push({
      message: "Slept, ping, waiting 2 seconds...",
      eventName: "side-panel-ping",
      eventId: uuidv7(),
    });

    await new Promise(function (resolve) {
      setTimeout(resolve, 2000);
    });

    sse.push({
      message: "Slept, pong, - your context was: " + context,
      eventName: "side-panel-pong",
      eventId: uuidv7(),
    });
  })
);

export default router;
