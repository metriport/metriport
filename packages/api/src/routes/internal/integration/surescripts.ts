import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler } from "../../util";

dayjs.extend(duration);
const router = Router();

/** ---------------------------------------------------------------------------
 * GET /internal/surecripts/patient/:id
 *
 * Retrieves validated patient, facility, and customer data used in a Surescripts request.
 *
 * @param req.query.cxId - The CX ID.
 * @param req.query.facilityId - The facility ID.
 */
router.get(
  "/patient/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    // const cxId = getCxIdOrFail(req);
    // const patientId = getFromParamsOrFail("id", req);
    // TODO
    return res.status(status.OK);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/surescripts/patient/:id
 *
 * Updates the patient mapping for a current Surescripts request. This can be used to clear the request ID
 * from the patient mapping when a successful response is received, or to reset a patient for a new request.
 *
 * @see packages/infra/lib/quest/quest-stack.ts
 * @returns 200 OK
 */
router.post(
  "/patient/:id",
  requestLogger,
  asyncHandler(async (_: Request, res: Response) => {
    // TODO
    return res.sendStatus(status.OK);
  })
);
