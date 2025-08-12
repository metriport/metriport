import { createQueryMetaSchema, PaginatedResponse } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { z } from "zod";

import { Pagination } from "../../command/pagination";
import {
  getHieDirectoryEntriesByFilter,
  getHieDirectoryEntriesByFilterCount,
} from "../../external/hie/command/get-hie-directory-entries";
import { requestLogger } from "../helpers/request-logger";
import { paginated } from "../pagination";
import { asyncHandler } from "../util";
import { dtoFromHieDirectoryEntry, NetworkEntryDTO } from "./dtos/network-entry-dto";

export const networkEntryGetSchema = z
  .object({
    filter: z.string().optional(),
  })
  .and(createQueryMetaSchema());

const router = Router();

/** ---------------------------------------------------------------------------
 * GET /network-entry
 *
 * Gets all HIE (AKA Network) directory entries that Metriport has access to.
 *
 * @param   req.query.filter      Full text search filters. See https://docs.metriport.com/medical-api/more-info/search-filters
 * @param   req.query.fromItem    The minimum item to be included in the response, inclusive.
 * @param   req.query.toItem      The maximum item to be included in the response, inclusive.
 * @param   req.query.count       The number of items to be included in the response.
 * @returns An object containing:
 * - `networkEntries` - The network entries in the current page.
 * - `meta` - Pagination information, including how to get to the next page.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const params = networkEntryGetSchema.parse(req.query);
    const additionalQueryParams = params.filter ? { filter: params.filter } : undefined;

    const { meta, items } = await paginated({
      request: req,
      additionalQueryParams,
      getItems: (pagination: Pagination) => {
        return getHieDirectoryEntriesByFilter({ filter: params.filter, pagination });
      },
      getTotalCount: () => getHieDirectoryEntriesByFilterCount({ filter: params.filter }),
    });

    const response: PaginatedResponse<NetworkEntryDTO, "networkEntries"> = {
      meta,
      networkEntries: items.map(dtoFromHieDirectoryEntry),
    };

    return res.status(status.OK).json(response);
  })
);

export default router;
