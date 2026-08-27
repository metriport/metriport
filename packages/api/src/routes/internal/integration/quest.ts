import { buildIngestAllResponsesHandler } from "@metriport/core/external/quest/command/ingest-all-responses/ingest-all-responses-factory";
import { buildQuestUploadRosterHandler } from "@metriport/core/external/quest/command/upload-roster/upload-roster-factory";
import { Config } from "@metriport/core/util/config";
import { BadRequestError } from "@metriport/shared";
import {
  isValidQuestRosterType,
  QuestRosterType,
} from "@metriport/shared/interface/external/quest/roster";
import { questSource } from "@metriport/shared/interface/external/quest/source";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { findPatientWithExternalId } from "../../../command/mapping/patient";
import {
  getQuestBackfillRoster,
  getQuestNotificationRoster,
} from "../../../command/medical/patient/get-quest-roster";
import { Pagination } from "../../../command/pagination";
import { requestLogger } from "../../helpers/request-logger";
import { dtoFromModel as dtoFromPatientMappingModel } from "../../medical/dtos/patient-mapping";
import { dtoFromModel as dtoFromPatientModel } from "../../medical/dtos/patientDTO";
import { paginated } from "../../pagination";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler, getFromParamsOrFail, getFromQueryOrFail } from "../../util";

dayjs.extend(duration);
const router = Router();

/**
 * Validates the roster type from the request parameters, and throws a BadRequestError if it is invalid.
 */
function getRosterTypeFromParamsOrFail(req: Request): QuestRosterType {
  const rosterTypeParam = getFromParamsOrFail("rosterType", req);
  if (!isValidQuestRosterType(rosterTypeParam)) {
    throw new BadRequestError("Invalid roster type", undefined, {
      rosterType: rosterTypeParam,
    });
  }
  return rosterTypeParam;
}

/** ---------------------------------------------------------------------------
 * GET /internal/quest/roster/notifications
 *
 * This is a paginated route.
 *
 * Gets all patients that are enrolled in Quest monitoring for the notifications roster.
 *
 * @param req.query.fromItem The minimum item to be included in the response, inclusive.
 * @param req.query.toItem The maximum item to be included in the response, inclusive.
 * @param req.query.count The number of items to be included in the response.
 * @returns An object containing:
 * - `patients` - List of patients enrolled in Quest monitoring.
 * - `meta` - Pagination information, including how to get to the next page.
 */
router.get(
  "/roster/notifications",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { meta, items } = await paginated({
      request: req,
      additionalQueryParams: {},
      getItems: (pagination: Pagination) => {
        return getQuestNotificationRoster({
          pagination,
        });
      },
      getTotalCount: () => {
        // There's no use for calculating the actual number of subscribers for this route
        return Promise.resolve(-1);
      },
      hostUrl: Config.getApiLoadBalancerAddress(),
    });
    return res
      .status(status.OK)
      .json({ meta, patients: items.map(item => dtoFromPatientModel(item)) });
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/quest/roster/backfill
 *
 * This is a paginated route.
 *
 * Gets all patients that are enrolled in Quest monitoring for the backfill roster for a given customer and roster.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.rosterId The roster ID.
 * @param req.query.fromItem The minimum item to be included in the response, inclusive.
 * @param req.query.toItem The maximum item to be included in the response, inclusive.
 * @param req.query.count The number of items to be included in the response.
 * @returns An object containing:
 * - `patients` - List of patients enrolled in Quest monitoring.
 * - `meta` - Pagination information, including how to get to the next page.
 */
router.get(
  "/roster/backfill",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const rosterId = getUUIDFrom("query", req, "rosterId").orFail();
    const { meta, items } = await paginated({
      request: req,
      additionalQueryParams: { cxId, rosterId },
      getItems: (pagination: Pagination) => {
        return getQuestBackfillRoster({
          cxId,
          rosterId,
          pagination,
        });
      },
      getTotalCount: () => {
        // There's no use for calculating the actual number of subscribers for this route
        return Promise.resolve(-1);
      },
      hostUrl: Config.getApiLoadBalancerAddress(),
    });
    return res
      .status(status.OK)
      .json({ meta, patients: items.map(item => dtoFromPatientModel(item)) });
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
    const rosterType = getRosterTypeFromParamsOrFail(req);
    const cxId = getUUIDFrom("query", req, "cxId").optional();
    const rosterId = getUUIDFrom("query", req, "rosterId").optional();
    if ((cxId && !rosterId) || (!cxId && rosterId)) {
      throw new BadRequestError("Both cxId and rosterId must be provided together");
    }

    const handler = buildQuestUploadRosterHandler();
    await handler.uploadRoster({
      rosterType,
      ...(cxId && rosterId ? { cxId, rosterId } : {}),
    });
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
 * POST /internal/quest/ingest-all-responses
 *
 * Ingest all available update files from Quest Diagnostics. This route is triggered by a scheduled Lambda
 * function to coincide with the daily updates, and can also be manually triggered by an internal user to ingest
 * all new responses. The ingest handler will automatically trigger the next steps of the data pipeline, which
 * convert the ingested responses into FHIR bundles that make their way to the lab conversion bucket.
 *
 * @see packages/infra/lib/quest/quest-stack.ts
 * @returns 200 OK
 */
router.post(
  "/ingest-all-responses",
  requestLogger,
  asyncHandler(async (_: Request, res: Response) => {
    const handler = buildIngestAllResponsesHandler();
    await handler.ingestAllResponses();
    return res.sendStatus(status.OK);
  })
);

export default router;
