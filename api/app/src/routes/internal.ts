import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { accountInit } from "../command/account-init";
import { asyncHandler, getCxIdFromQueryOrFail } from "./util";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /internal/init
 *
 * Initialize a (customer's) account. This is an idempotent operation, which
 * means it can be called multiple times without side effects.
 *
 * @param req.query.cxId - The customer/account's ID.
 * @return 200 Indicating the account has been initialized.
 */
router.post(
  "/init",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdFromQueryOrFail(req);
    await accountInit(cxId);
    return res.sendStatus(status.OK);
  })
);

export default router;
