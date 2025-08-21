import { Config } from "@metriport/core/util/config";
import { PaginatedResponse } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { getQuestRoster } from "../../../command/medical/patient/get-quest-roster";
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

export default router;
