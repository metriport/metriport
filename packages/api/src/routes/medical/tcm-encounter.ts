import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { Op } from "sequelize";
import { Pagination } from "../../command/pagination";
import { TcmEncounterModel } from "../../models/medical/tcm-encounter";
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
export const updateTcmEncounter = async (req: Request, res: Response) => {
  const cxId = getCxIdOrFail(req);
  const id = getFromParamsOrFail("id", req);
  const data = tcmEncounterUpdateSchema.parse(req.body);

  const encounter = await TcmEncounterModel.findByPk(id);
  if (!encounter) {
    return res.status(httpStatus.NOT_FOUND).json({
      message: `TCM encounter with ID ${id} not found`,
    });
  }

  await TcmEncounterModel.update(data, {
    where: {
      id,
      cxId,
    },
  });

  const updatedEncounter = await TcmEncounterModel.findByPk(id);
  if (!updatedEncounter) {
    throw new Error("Failed to fetch updated encounter");
  }

  return res.status(httpStatus.OK).json(updatedEncounter);
};

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
export const listTcmEncounters = async (req: Request, res: Response) => {
  const cxId = getCxIdOrFail(req);
  const query = tcmEncounterListQuerySchema.parse(req.query);
  const DEFAULT_FILTER_DATE = new Date("2020-01-01T00:00:00.000Z");

  const where: Record<string, unknown> = {
    cxId,
    admitTime: {
      [Op.gt]: DEFAULT_FILTER_DATE,
    },
  };

  if (query.after) {
    where.admitTime = {
      ...(where.admitTime as Record<string, unknown>),
      [Op.gt]: new Date(query.after),
    };
  }

  const result = await paginated({
    request: req,
    additionalQueryParams: undefined,
    getItems: async (pagination: Pagination) => {
      const { rows } = await TcmEncounterModel.findAndCountAll({
        where,
        limit: pagination.count + 1, // Get one extra to determine if there's a next page
        order: [["admitTime", "DESC"]],
      });
      return rows;
    },
    getTotalCount: async () => {
      const { count } = await TcmEncounterModel.findAndCountAll({
        where,
      });
      return count;
    },
  });

  return res.status(httpStatus.OK).json(result);
};

router.put("/:id", requestLogger, asyncHandler(updateTcmEncounter));

router.get("/", requestLogger, asyncHandler(listTcmEncounters));

export default router;
