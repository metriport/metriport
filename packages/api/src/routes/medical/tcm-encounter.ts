import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { Op } from "sequelize";
import { Pagination } from "../../command/pagination";
import { TcmEncounterModel } from "../../models/medical/tcm-encounter";
import { requestLogger } from "../helpers/request-logger";
import { paginated } from "../pagination";
import { asyncHandler, getFromParamsOrFail } from "../util";
import {
  tcmEncounterCreateSchema,
  tcmEncounterListQuerySchema,
  tcmEncounterUpdateSchema,
} from "./schemas/tcm-encounter";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /dash-oss/medical/v1/tcm/encounter
 *
 * Creates a new TCM encounter.
 *
 * @param req.body - The TCM encounter data to create.
 * @returns The created TCM encounter.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const data = tcmEncounterCreateSchema.parse(req.body);
    const encounter = await TcmEncounterModel.create({
      cxId: req.cxId ?? "",
      patientId: data.patientId,
      facilityName: data.facilityName,
      latestEvent: data.latestEvent,
      class: data.class,
      admitTime: new Date(data.admitTime),
      dischargeTime: data.dischargeTime ? new Date(data.dischargeTime) : null,
      clinicalInformation: data.clinicalInformation,
      version: 0,
    });
    return res.status(httpStatus.CREATED).json(encounter);
  })
);

/** ---------------------------------------------------------------------------
 * PUT /dash-oss/medical/v1/tcm/encounter/:id
 *
 * Updates an existing TCM encounter.
 *
 * @param req.params.id - The ID of the TCM encounter to update.
 * @param req.body - The TCM encounter data to update.
 * @returns The updated TCM encounter.
 */
router.put(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const id = getFromParamsOrFail("id", req);
    const data = tcmEncounterUpdateSchema.parse(req.body);

    const encounter = await TcmEncounterModel.findByPk(id);
    if (!encounter) {
      return res.status(httpStatus.NOT_FOUND).json({
        message: `TCM encounter with ID ${id} not found`,
      });
    }

    const updateData = {
      ...data,
      version: encounter.version + 1,
      admitTime: data.admitTime ? new Date(data.admitTime) : undefined,
      dischargeTime: data.dischargeTime ? new Date(data.dischargeTime) : undefined,
      updatedAt: new Date(),
    };

    await TcmEncounterModel.update(updateData, {
      where: {
        id,
        cxId: req.cxId ?? "",
      },
    });

    return res.status(httpStatus.OK).json(encounter);
  })
);

/** ---------------------------------------------------------------------------
 * GET /dash-oss/medical/v1/tcm/encounter
 *
 * Lists TCM encounters with pagination.
 *
 * @param req.query.after - Optional date to filter encounters after.
 * @param req.query.limit - Optional number of items per page.
 * @param req.query.offset - Optional offset for pagination.
 * @returns Paginated list of TCM encounters.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const query = tcmEncounterListQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {
      cxId: req.cxId ?? "",
      admitTime: {
        [Op.gt]: new Date("2020-01-01T00:00:00.000Z"), // Default filter to use composite index
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
  })
);

export default router;
