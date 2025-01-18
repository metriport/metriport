import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { getCQDirectoryEntriesByFilter } from "../../external/carequality/command/cq-directory/get-cq-directory-entries";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler } from "../util";
import { networkGetSchema } from "./schemas/network";

const router = Router();

router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const params = networkGetSchema.parse(req.query);

    const networks = await getCQDirectoryEntriesByFilter({ filter: params.filter || "" });

    return res.status(status.OK).json({ networks });
  })
);

export default router;
