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
 * Tries to retrieve the matching Metriport patient on appointment created
 * @param req.params.id The ID of Elation Patient.
 * @returns Metriport Patient if found.
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
