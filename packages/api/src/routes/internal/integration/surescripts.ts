import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler } from "../../util";
import { buildReceiveAllHandler } from "@metriport/core/external/surescripts/command/receive-all/receive-all-factory";

dayjs.extend(duration);
const router = Router();

/** ---------------------------------------------------------------------------
 * POST /internal/surescripts/receive-all
 *
 * Receives all new Surescripts responses from the Surescripts SFTP server and uploads them to the Surescripts replica.
 * This triggers the next steps of the data pipeline, which convert the received responses to FHIR bundles.
 *
 * @returns 200 OK
 */
router.post(
  "/receive-all",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const handler = buildReceiveAllHandler();
    const result = await handler.receiveAllNewResponses({ maxResponses: 10 });
    return res.status(status.OK).json(result);
  })
);
