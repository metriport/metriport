import { Request, Response } from "express";
import Router from "express-promise-router";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler } from "../util";
import status from "http-status";

const router = Router();

router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    return res.status(status.OK).json({ cxId: "none" });
  })
);

export default router;
