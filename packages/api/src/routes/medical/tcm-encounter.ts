import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import {
  getTcmEncounters,
  getTcmEncountersCount,
} from "../../command/medical/tcm-encounter/get-tcm-encounters";
import { updateTcmEncounter } from "../../command/medical/tcm-encounter/update-tcm-encounter";
import { requestLogger } from "../helpers/request-logger";
import { paginated } from "../pagination";
import { validateUUID } from "../schemas/uuid";
import { asyncHandler, getCxIdOrFail, getFromParamsOrFail } from "../util";
import { dtoFromTcmEncounter } from "./dtos/tcm-encounter-dto";
import { tcmEncounterListQuerySchema, tcmEncounterUpdateSchema } from "./schemas/tcm-encounter";

const router = Router();

/** ---------------------------------------------------------------------------
 * PUT /dash-oss/medical/v1/tcm/encounter/:id
 *
 * Updates an existing TCM encounter. This endpoint is used by the frontend, and does not allow
 * the frontend to create new tcm encounters.
 *
 * @param req.params.id The ID of the TCM encounter to update.
 * @param req.body The data to update the TCM encounter.
 * @returns The updated TCM encounter.
 */
router.put(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const cxId = getCxIdOrFail(req);
    const id = validateUUID(getFromParamsOrFail("id", req), "id");
    const body = tcmEncounterUpdateSchema.parse(req.body);

    const result = await updateTcmEncounter({ ...body, id, cxId });

    return res.status(httpStatus.OK).json(result.encounter);
  })
);

/** ---------------------------------------------------------------------------
 * GET /dash-oss/medical/v1/tcm/encounter
 *
 * Lists TCM encounters for the customer, with optional filtering and pagination.
 *
 * @param req.query.after Optional ISO datetime string to filter encounters after this date.
 * @param req.query.fromItem Optional pagination parameter to start from a specific item.
 * @param req.query.toItem Optional pagination parameter to end at a specific item.
 * @param req.query.count Optional number of items per page (max 50).
 * @returns A paginated list of TCM encounters.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const query = tcmEncounterListQuerySchema.parse(req.query);

    const result = await paginated({
      request: req,
      additionalQueryParams: undefined,
      getItems: async pagination => {
        return await getTcmEncounters({
          cxId,
          after: query.after,
          pagination,
        });
      },
      getTotalCount: async () => {
        return await getTcmEncountersCount({ cxId, after: query.after });
      },
    });

    return res.status(httpStatus.OK).json({
      ...result,
      items: result.items.map(dtoFromTcmEncounter),
    });
  })
);

export default router;
