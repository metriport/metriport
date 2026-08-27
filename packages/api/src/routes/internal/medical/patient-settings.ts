import { createQueryMetaSchemaV2 } from "@metriport/shared/domain/pagination-v2";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import {
  getPatientIdsCountForPatientsWithAdtSubscriptions,
  getPatientIdsForPatientsWithAdtSubscriptions,
  getPatientIdsForPatientsWithLaboratoryNotifications,
} from "../../../command/medical/patient/settings/get-patient-settings";
import { requestLogger } from "../../helpers/request-logger";
import { paginatedV2 } from "../../pagination-v2";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler } from "../../util";

dayjs.extend(duration);

const router = Router();

/** ---------------------------------------------------------------------------
 * GET /internal/patient/settings/laboratory-notifications
 *
 * Returns the patient IDs for patients with laboratory notification subscriptions for a given customer.
 *
 * @param req.query.cxId The customer ID.
 * @returns 200 with the array of patient IDs.
 */
router.get(
  "/laboratory-notifications",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();

    const patientIds = await getPatientIdsForPatientsWithLaboratoryNotifications({ cxId });
    return res.status(status.OK).json(patientIds);
  })
);

const ADT_PATIENT_IDS_MAX_PAGE_SIZE = 1000;
const adtPatientIdsQuerySchema = createQueryMetaSchemaV2(ADT_PATIENT_IDS_MAX_PAGE_SIZE);

/** ---------------------------------------------------------------------------
 * GET /internal/patient/settings/adt
 *
 * Returns the patient IDs for patients with ADT subscriptions for a given customer with pagination support.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.fromItem Optional pagination parameter to start from a specific item.
 * @param req.query.toItem Optional pagination parameter to end at a specific item.
 * @param req.query.count Optional number of items per page (max 1000).
 * @param req.query.sort Optional sort parameter (e.g., "id=asc").
 * @returns 200 with the paginated patient IDs.
 */
router.get(
  "/adt",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();

    adtPatientIdsQuerySchema.parse(req.query);

    const result = await paginatedV2({
      request: req,
      additionalQueryParams: { cxId },
      getItems: async pagination => {
        const patientIds = await getPatientIdsForPatientsWithAdtSubscriptions({
          cxId,
          pagination,
        });
        return patientIds;
      },
      getTotalCount: () => getPatientIdsCountForPatientsWithAdtSubscriptions({ cxId }),
      allowedSortColumns: {
        id: { table: "ps", column: "patient_id", type: "regular" },
      },
      maxItemsPerPage: ADT_PATIENT_IDS_MAX_PAGE_SIZE,
    });

    return res.status(status.OK).json({
      meta: result.meta,
      patientIds: result.items.map(item => item.id),
    });
  })
);

export default router;
