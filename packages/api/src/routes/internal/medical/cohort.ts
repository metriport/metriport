import { Request, Response } from "express";
import Router from "express-promise-router";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getFromParamsOrFail } from "../../util";
import { getUUIDFrom } from "../../schemas/uuid";
import { updateCohort } from "../../../command/medical/cohort/update-cohort";
import { createFullCohortUpdateSchema } from "@metriport/shared/domain/cohort";
import { getHieNames } from "@metriport/core/external/hl7-notification/hie-config-dictionary";
import httpStatus from "http-status";

const router = Router();

/** ---------------------------------------------------------------------------
 *
 * PUT /internal/cohort/:id
 *
 * Updates a cohort's settings with overrides.
 *
 * @param req.params.id The ID of the cohort to update.
 * @param req.body The new cohort settings.
 * @returns The updated cohort.
 */
router.put(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getFromParamsOrFail("id", req);

    const hieNames = getHieNames();
    const fullCohortUpdateSchema = createFullCohortUpdateSchema(hieNames);
    const cohortData = fullCohortUpdateSchema.parse(req.body);
    
    const cohort = await updateCohort({ id, cxId, ...cohortData });

    // Purposely avoid calling applyCohortDtoToPayload to show overrides.
    return res.status(httpStatus.OK).json(cohort);
  })
);

export default router;
