import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler } from "../../util";

const router = Router();

/**
 * POST /ehr/webhook/elation/appointments
 *
 * Currently does nothing.
 */
router.post(
  "/",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    return res.status(httpStatus.NOT_IMPLEMENTED).send();
  })
);

export default router;
