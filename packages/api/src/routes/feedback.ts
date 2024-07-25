import NotFoundError from "@metriport/core/util/error/not-found";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { z } from "zod";
import { requestLogger } from "./helpers/request-logger";
import { asyncHandler, getFromParamsOrFail } from "./util";

const router = Router();

/** ---------------------------------------------------------------------------
 * GET /feedback
 *
 * WIP
 * WIP
 * WIP
 * WIP
 *
 */
router.get(
  "/:id",
  // processFeedbackAccess,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const id = getFromParamsOrFail("id", req);
    if (id === "123") {
      return res.status(status.OK).json({ id, status: "active" });
    }
    if (id === "000") {
      return res.sendStatus(500);
    }
    throw new NotFoundError(`Feedback ${id} not found`);
  })
);

const feedbackSubmissionSchema = z.object({
  name: z.string().nullish(),
  details: z.string(),
});

router.post(
  "/:id",
  // processFeedbackAccess,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const id = getFromParamsOrFail("id", req);
    const { name, details } = feedbackSubmissionSchema.parse(req.body);
    console.log(`Storing the feedback for ${id}, from '${name}': ${details}`);
    return res.status(status.OK).json({ id, status: "submitted" });
  })
);

export default router;
