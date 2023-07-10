import { Request, Response } from "express";
import Router from "express-promise-router";
import { asyncHandler } from "../util";
import { processData } from "../../command/webhook/fitbit";

const routes = Router();

// This value is provided on the dev.fitbit dashboard when you update or craete a new webhook subscriber.
const FITBIT_VERIFICATION_CODE = "";

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
      if (req.query.verify === FITBIT_VERIFICATION_CODE) {
        console.log("Received correct verification code.");
        return res.sendStatus(204);
      } else {
        console.log("Incorrect verification code detected!");
        return res.sendStatus(404);
      }
    } else {
      return res.sendStatus(200);
    }
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
    return res.sendStatus(200);
  })
);

export default routes;
