import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { z } from "zod";
import { getFeedbackOrFail } from "../command/feedback/feedback";
import { createFeedbackEntry } from "../command/feedback/feedback-entry";
import { requestLogger } from "./helpers/request-logger";
import { handleParams } from "./helpers/handle-params";
import { asyncHandler, getFromParamsOrFail } from "./util";

const router = Router();

/** ---------------------------------------------------------------------------
 * GET /feedback/:id
 *
 * Returns the id and status of the feedback.
 * Mostly to validate it exists.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const id = getFromParamsOrFail("id", req);
    await getFeedbackOrFail({ id });
    return res.status(status.OK).json({ id });
  })
);

const feedbackSubmissionSchema = z.object({
  feedbackId: z.string(),
  comment: z.string(),
  name: z.string().nullish(),
});

/** ---------------------------------------------------------------------------
 * POST /feedback/entry
 *
 * Creates a feedback entry.
 */
router.post(
  "/entry",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { feedbackId, name, comment } = feedbackSubmissionSchema.parse(req.body);
    await createFeedbackEntry({
      feedbackId,
      comment,
      authorName: name ?? undefined,
    });
    return res.status(status.OK).json({ status: "created" });
  })
);

export default router;
