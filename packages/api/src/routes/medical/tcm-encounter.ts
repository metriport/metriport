import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { listTcmEncounters } from "../../command/medical/tcm-encounter/list-tcm-encounters";
import { updateTcmEncounter } from "../../command/medical/tcm-encounter/update-tcm-encounter";
import { requestLogger } from "../helpers/request-logger";
import { paginated } from "../pagination";
import { asyncHandler, getCxIdOrFail, getFromParamsOrFail } from "../util";
import { tcmEncounterListQuerySchema, tcmEncounterUpdateSchema } from "./schemas/tcm-encounter";

const router = Router();

/** ---------------------------------------------------------------------------
 * PUT /tcm/encounter/:id
 *
 * Updates an existing TCM encounter.
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
    const id = getFromParamsOrFail("id", req);
    const body = tcmEncounterUpdateSchema.parse(req.body);

    const result = await updateTcmEncounter({ ...body, id, cxId });

    return res.status(httpStatus.OK).json(result.encounter);
  })
);

/** ---------------------------------------------------------------------------
 * GET /tcm/encounter
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
        const { items } = await listTcmEncounters({
          cxId,
          after: query.after,
          pagination,
        });
        return items;
      },
      getTotalCount: async () => {
        const { totalCount } = await listTcmEncounters({
          cxId,
          after: query.after,
          pagination: { count: 1, fromItem: undefined, toItem: undefined },
        });
        return totalCount;
      },
    });

    return res.status(httpStatus.OK).json(result);
  })
);

export default router;
