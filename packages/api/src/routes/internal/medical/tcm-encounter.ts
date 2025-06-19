import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { createTcmEncounter } from "../../../command/medical/tcm-encounter/create-tcm-encounter";
import { requestLogger } from "../../helpers/request-logger";
import { tcmEncounterCreateSchema } from "../../medical/schemas/tcm-encounter";
import { asyncHandler } from "../../util";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /internal/tcm/encounter
 *
 * Creates a new TCM encounter. This endpoint is used by the HL7 notification webhook sender.
 *
 * @param req.body - The TCM encounter data to create.
 * @returns The created TCM encounter.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const data = tcmEncounterCreateSchema.parse(req.body);
    const encounter = await createTcmEncounter(data);
    return res.status(httpStatus.CREATED).json(encounter);
  })
);

export default router;
