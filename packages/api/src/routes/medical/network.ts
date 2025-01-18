import { Request, Response } from "express";
import Router from "express-promise-router";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler } from "../util";
import status from "http-status";
import { networkGetSchema } from "./schemas/network";

const router = Router();

router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const params = networkGetSchema.parse(req.query);
    return res.status(status.OK).json({ params });
  })
);

export default router;
