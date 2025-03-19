import { createFeedbackSchema } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createOrUpdateFeedback, getFeedbackOrFail } from "../../../command/feedback/feedback";
import { getFeedbackEntryOrFail } from "../../../command/feedback/feedback-entry";
import { FeedbackData } from "../../../domain/feedback";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getFrom } from "../../util";
import { handleParams } from "../../helpers/handle-params";

const router = Router();

/** ---------------------------------------------------------------------------
 * PUT /internal/feedback/:id
 *
 * Creates or updates a feedback (group of multiple feedback entries).
 */
router.put(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const id = getFrom("params").orFail("id", req);
    const { cxId, entityId, content, version, location } = createFeedbackSchema.parse(req.body);
    const data: FeedbackData = {
      content,
      version: version ?? undefined,
      location: location ?? undefined,
    };
    await createOrUpdateFeedback({ id, cxId, entityId, data });
    return res.status(status.OK).json({ id, cxId, entityId, status: "ok" });
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/feedback/entry/:id
 *
 * Returns data about a single feedback entry and its original content.
 */
router.get(
  "/entry/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const id = getFrom("params").orFail("id", req);
    const feedbackEntry = await getFeedbackEntryOrFail({ id });
    const feedback = await getFeedbackOrFail({ id: feedbackEntry?.feedbackId });
    return res.status(status.OK).json({ feedback, feedbackEntry });
  })
);

export default router;
