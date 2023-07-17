import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { processData } from "../../command/webhook/fitbit";
import { Config } from "../../shared/config";
import { asyncHandler } from "../util";

const routes = Router();

/** ---------------------------------------------------------------------------
 * GET /webhook/fitbit
 *
 * Verify Fitbit WH subscriber. Receives a verification notification and sends back a verification post request.
 *
 */
routes.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    if (req.query.verify) {
      console.log(
        "Verifying the subscriber. Make sure to use the verification code provided in the dev.fitbit dashboard!"
      );

      if (req.query.verify === Config.getFitbitVerificationCode()) {
        console.log("Received correct verification code.");
        return res.sendStatus(status.NO_CONTENT);
      } else {
        console.log("Incorrect verification code detected!");
        return res.sendStatus(status.NOT_FOUND);
      }
    }

    return res
      .sendStatus(status.NOT_FOUND)
      .json({ error: "Subscriber verification code not provided." });
  })
);

/** ---------------------------------------------------------------------------
 * POST /webhook/fitbit
 *
 * Receive fitbit data for all data types for the specified user ID
 *
 */
routes.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    processData(req.body);
    return res.sendStatus(status.OK);
  })
);

export default routes;
