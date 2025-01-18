import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import {
  getCQDirectoryEntriesByFilter,
  getCQDirectoryEntriesByFilterCount,
} from "../../external/carequality/command/cq-directory/get-cq-directory-entries";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler } from "../util";
import { dtoFromCQDirectoryEntry, NetworkDTO } from "./dtos/networkDTO";
import { networkGetSchema } from "./schemas/network";

import { PaginatedResponse } from "@metriport/shared";
import { Pagination } from "../../command/pagination";
import { paginated } from "../pagination";

const router = Router();

router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const params = networkGetSchema.parse(req.query);
    const additionalQueryParams = params.filter ? { filter: params.filter } : undefined;

    const { meta, items } = await paginated({
      request: req,
      additionalQueryParams,
      getItems: (pagination: Pagination) => {
        return getCQDirectoryEntriesByFilter({ filter: params.filter || "", pagination });
      },
      getTotalCount: () => getCQDirectoryEntriesByFilterCount({ filter: params.filter || "" }),
    });

    const response: PaginatedResponse<NetworkDTO, "networks"> = {
      meta,
      networks: items.map(dtoFromCQDirectoryEntry),
    };

    return res.status(status.OK).json(response);
  })
);

export default router;
