import Router from "express-promise-router";
import { Request, Response } from "express";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler } from "../../util";
import { checkJwtToken, saveJwtToken } from "../shared";

const router = Router();

/**
 * GET /ehr/athena/jwt
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    await checkJwtToken("athenahealth", req, res);
  })
);

/**
 * POST /ehr/athena/jwt
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    await saveJwtToken("athenahealth", req, res);
  })
);

export default router;
