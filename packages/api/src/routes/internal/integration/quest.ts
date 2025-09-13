import { Config } from "@metriport/core/util/config";
import { PaginatedResponse } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { getQuestRoster } from "../../../command/medical/patient/get-quest-roster";
import { QuestUploadRosterHandlerCloud } from "@metriport/core/external/quest/command/upload-roster/upload-roster-cloud";
import { QuestDownloadResponseHandlerCloud } from "@metriport/core/external/quest/command/download-response/download-response-cloud";
import { Pagination } from "../../../command/pagination";
import { dtoFromModel, PatientDTO } from "../../medical/dtos/patientDTO";
import { requestLogger } from "../../helpers/request-logger";
import { paginated } from "../../pagination";
import { asyncHandler } from "../../util";

dayjs.extend(duration);
const router = Router();

/** ---------------------------------------------------------------------------
 * GET /internal/quest/roster
 *
 * This is a paginated route.
 * Gets all patients that are enrolled in Quest monitoring.
 *
 * @param req.query.fromItem The minimum item to be included in the response, inclusive.
 * @param req.query.toItem The maximum item to be included in the response, inclusive.
 * @param req.query.count The number of items to be included in the response.
 * @returns An object containing:
 * - `patients` - List of patients enrolled in Quest monitoring.
 * - `meta` - Pagination information, including how to get to the next page.
 */
router.get(
  "/roster",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { meta, items } = await paginated({
      request: req,
      additionalQueryParams: {},
      getItems: (pagination: Pagination) => {
        return getQuestRoster({
          pagination,
        });
      },
      getTotalCount: () => {
        // There's no use for calculating the actual number of subscribers for this route
        return Promise.resolve(-1);
      },
      hostUrl: Config.getApiLoadBalancerAddress(),
    });

    const response: PaginatedResponse<PatientDTO, "patients"> = {
      meta,
      patients: items.map(item => dtoFromModel(item)),
    };
    return res.status(status.OK).json(response);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/quest/upload-roster
 *
 * Uploads the latest patient roster to Quest Diagnostics. This route is triggered by a scheduled Lambda
 * function, and can also be manually triggered by an internal user to upload the latest roster. It *always*
 * triggers the QuestUploadRoster handler, since any roster uploads to Quest must originate from a whitelisted
 * VPC IP address.
 *
 * @see packages/infra/lib/quest/quest-stack.ts
 * @returns 200 OK
 */
router.post(
  "/upload-roster",
  requestLogger,
  asyncHandler(async (_: Request, res: Response) => {
    const handler = new QuestUploadRosterHandlerCloud();
    await handler.generateAndUploadLatestQuestRoster();
    return res.sendStatus(status.OK);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/quest/download-response
 *
 * Downloads all available update files from Quest Diagnostics. This route is triggered by a scheduled Lambda
 * function to coincide with the daily updates, and can also be manually triggered by an internal user to download
 * all new responses. The download handler will automatically trigger the next steps of the data pipeline, which
 * convert the downloaded responses into FHIR bundles that make their way to the lab conversion bucket.
 *
 * @see packages/infra/lib/quest/quest-stack.ts
 * @returns 200 OK
 */
router.post(
  "/download-response",
  requestLogger,
  asyncHandler(async (_: Request, res: Response) => {
    const handler = new QuestDownloadResponseHandlerCloud();
    await handler.downloadAllQuestResponses();
    return res.sendStatus(status.OK);
  })
);

export default router;
