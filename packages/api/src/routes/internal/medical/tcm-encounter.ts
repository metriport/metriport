import { out } from "@metriport/core/util";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { createTcmEncounter } from "../../../command/medical/tcm-encounter/create-tcm-encounter";
import { upsertTcmEncounter } from "../../../command/medical/tcm-encounter/upsert-tcm-encounter";
import { requestLogger } from "../../helpers/request-logger";
import {
  tcmEncounterCreateSchema,
  tcmEncounterUpsertSchema,
} from "../../medical/schemas/tcm-encounter";
import { asyncHandler } from "../../util";

const router = Router();

/** ---------------------------------------------------------------------------
 * PUT /internal/tcm/encounter
 *
 * Upserts a TCM encounter. This endpoint is used by the HL7 notification webhook sender.
 * If the payload has an ID and all required fields, it will upsert. Otherwise, it will create.
 *
 * @param req.body - The TCM encounter data to create or upsert.
 * @returns The created or upserted TCM encounter.
 */
router.put(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { log } = out("PUT /internal/tcm/encounter");
    // We separately handle upsert and create cases to simplify
    const upsertResult = tcmEncounterUpsertSchema.safeParse(req.body);
    if (upsertResult.success) {
      log(`Upserting TCM encounter: ${upsertResult.data.id}`);
      const encounter = await upsertTcmEncounter(upsertResult.data);
      return res.status(httpStatus.OK).json(encounter);
    }

    const createResult = tcmEncounterCreateSchema.safeParse(req.body);
    if (createResult.success) {
      log(`Creating TCM encounter: ${createResult.data.id}`);
      const encounter = await createTcmEncounter(createResult.data);
      return res.status(httpStatus.CREATED).json(encounter);
    } else {
      log(
        `Invalid payload: ${JSON.stringify(
          {
            ...req.body,
            clinicalInformation: undefined,
          },
          null,
          2
        )}`
      );
    }

    return res.status(httpStatus.BAD_REQUEST).json({
      error:
        "Invalid payload. Must provide either complete upsert data (with ID) or complete create data.",
      upsertErrors: upsertResult.success ? undefined : upsertResult.error.format(),
      createErrors: createResult.success ? undefined : createResult.error.format(),
    });
  })
);

export default router;
