import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { setupAthenaHealth } from "../../../../external/ehr/athenahealth/command/setup";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler, getFromQuery, getFromQueryOrFail } from "../../../util";
import { usStateForAddressSchema } from "@metriport/api-sdk/medical/models/common/address";
import { BadRequestError } from "@metriport/shared";

const router = Router();

/**
 * POST /internal/ehr/athenahealth/setup
 *
 * Setup a new cx in AthenaHealth.
 *
 * @param req.query.cxId - The customer ID
 * @param req.query.facilityId - The facility ID
 * @param req.query.athenaOnePracticeId - The AthenaHealth Practice ID (either numeric like 1234 or alphanumeric like a-1.Practice-1234)
 * @param req.query.state - The 2 letter state code (optional)
 * @returns 200 OK
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getUUIDFrom("query", req, "facilityId").orFail();
    const athenaOnePracticeId = getFromQueryOrFail("athenaOnePracticeId", req);
    const state2LetterCodeParam = getFromQuery("state", req);
    const state2LetterCode = state2LetterCodeParam
      ? parseState2LetterCode(state2LetterCodeParam)
      : undefined;

    await setupAthenaHealth({ cxId, facilityId, athenaOnePracticeId, state2LetterCode });

    return res.status(httpStatus.OK).json({ message: "AthenaHealth setup completed" });
  })
);

function parseState2LetterCode(state2LetterCodeParam: string): string {
  try {
    return usStateForAddressSchema.parse(state2LetterCodeParam);
  } catch (error) {
    throw new BadRequestError(
      "Invalid state code. Must be a 2 letter US State or Territory code (e.g. NY, CA, PR).",
      error,
      {
        input: state2LetterCodeParam,
      }
    );
  }
}

export default router;
