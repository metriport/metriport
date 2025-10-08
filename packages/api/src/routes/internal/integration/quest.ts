import { Config } from "@metriport/core/util/config";
import { PaginatedResponse } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { getQuestRoster } from "../../../command/medical/patient/get-quest-roster";
import { QuestRosterType, rosterTypeSchema } from "@metriport/core/external/quest/types";
import { QuestUploadRosterHandlerCloud } from "@metriport/core/external/quest/command/upload-roster/upload-roster-cloud";
import { QuestDownloadResponseHandlerCloud } from "@metriport/core/external/quest/command/download-response/download-response-cloud";
import { Subscriptions } from "@metriport/core/domain/patient-settings";
import { Pagination } from "../../../command/pagination";
import { dtoFromModel as dtoFromPatientModel, PatientDTO } from "../../medical/dtos/patientDTO";
import { dtoFromModel as dtoFromPatientMappingModel } from "../../medical/dtos/patient-mapping";
import { requestLogger } from "../../helpers/request-logger";
import { paginated } from "../../pagination";
import { asyncHandler, getFromParamsOrFail, getFromQueryOrFail } from "../../util";
import { findPatientWithExternalId } from "../../../command/mapping/patient";
import { questSource } from "@metriport/shared/interface/external/quest/source";

dayjs.extend(duration);
const router = Router();

const settingsKeyForRosterType: Record<
  QuestRosterType,
  keyof Pick<Subscriptions, "questNotifications" | "questBackfill">
> = {
  backfill: "questBackfill",
  notifications: "questNotifications",
};

/** ---------------------------------------------------------------------------
 * GET /internal/quest/roster/:rosterType
 *
 * This is a paginated route.
 * Gets all patients that are enrolled in Quest monitoring. The roster type can be "backfill" or "notifications", which
 * determines which setting to use in retrieving patients.
 *
 * @param req.query.fromItem The minimum item to be included in the response, inclusive.
 * @param req.query.toItem The maximum item to be included in the response, inclusive.
 * @param req.query.count The number of items to be included in the response.
 * @returns An object containing:
 * - `patients` - List of patients enrolled in Quest monitoring.
 * - `meta` - Pagination information, including how to get to the next page.
 */
router.get(
  "/roster/:rosterType",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const rosterType = getFromParamsOrFail("rosterType", req) as QuestRosterType;
    if (!rosterTypeSchema.safeParse(rosterType).success) {
      return res.sendStatus(status.BAD_REQUEST);
    }

    const settingsKey = settingsKeyForRosterType[rosterType];
    const { meta, items } = await paginated({
      request: req,
      additionalQueryParams: {},
      getItems: (pagination: Pagination) => {
        return getQuestRoster({
          pagination,
          settingsKey,
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
      patients: items.map(item => dtoFromPatientModel(item)),
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
  "/upload-roster/:rosterType",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const rosterType = getFromParamsOrFail("rosterType", req) as QuestRosterType;
    if (!rosterTypeSchema.safeParse(rosterType).success) {
      return res.sendStatus(status.BAD_REQUEST);
    }
    const handler = new QuestUploadRosterHandlerCloud();
    await handler.generateAndUploadLatestQuestRoster({ rosterType });
    return res.sendStatus(status.OK);
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/quest/patient/mapping
 *
 * Returns the patient ID and CX ID for a given external ID associated with a patient uploaded to the Quest roster.
 * @param req.query.externalId A 15 character external ID for the patient, associated with Quest.
 * @returns 200 OK with the Metriport patient ID and CX ID, or 404 if no mapping is found.
 */
router.get(
  "/patient/mapping",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const externalId = getFromQueryOrFail("externalId", req);
    const patientMapping = await findPatientWithExternalId({ externalId, source: questSource });
    if (patientMapping) {
      return res.status(status.OK).json(dtoFromPatientMappingModel(patientMapping));
    }
    return res.sendStatus(status.NOT_FOUND);
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
