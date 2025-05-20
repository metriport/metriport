import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getJwtTokenByIdOrFail } from "../../../command/jwt-token";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getFrom } from "../../util";

const router = Router();

/**
 * POST /internal/token/:id
 *
 * Get the JWT token by id
 *
 * @param req.params.id - The token id of the JWT token.
 * @returns The JWT token
 */
router.get(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const tokenId = getFrom("params").orFail("id", req);
    const token = await getJwtTokenByIdOrFail(tokenId);
    return res.status(httpStatus.OK).json(token);
  })
);

export default router;
