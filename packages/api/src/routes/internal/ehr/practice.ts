import { BadRequestError } from "@metriport/shared";
import { isEhrSource } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getSecrets } from "../../../external/ehr/shared/command/secrets/get-secrets";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * GET /internal/ehr/:ehrId/practice/:id/secrets
 *
 * Get the secrets for the practice
 *
 * @param req.query.ehrId - The EHR source.
 * @param req.query.cxId - The CX ID.
 * @param req.params.id - The practice id of the EHR integration.
 * @returns The secrets for the practice
 */
router.get(
  "/:id/secrets",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const practiceId = getFrom("params").orFail("id", req);
    const secrets = getSecrets({
      ehr,
      cxId,
      practiceId,
    });
    return res.status(httpStatus.OK).json(secrets);
  })
);

export default router;
