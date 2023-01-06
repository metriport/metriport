import { Request, Response } from "express";
import Router from "express-promise-router";
import { processData } from "../../command/webhook/webhook"

import { deregister, deregisterUsersSchema } from "../middlewares/oauth1";
import { asyncHandler } from "../util";

const routes = Router();


// TODO TEST
/** ---------------------------------------------------------------------------
 * POST /
 *
 * WEBHOOK CALL
 */
routes.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {

    console.log(req.body, '------------------------------------------------------------------------------')

    return res.sendStatus(200);
  })
);

export default routes;
