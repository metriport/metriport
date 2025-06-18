import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { v4 as uuidv4 } from "uuid";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { requestLogger } from "../../helpers/request-logger";
import { tcmEncounterCreateSchema } from "../../medical/schemas/tcm-encounter";
import { asyncHandler } from "../../util";

const router = Router();
router.post("/", requestLogger, asyncHandler(createTcmEncounter));

/** ---------------------------------------------------------------------------
 * POST /internal/tcm/encounter
 *
 * Creates a new TCM encounter. This endpoint is used by the HL7 notification webhook sender.
 *
 * @param req.body - The TCM encounter data to create.
 * @returns The created TCM encounter.
 */
export async function createTcmEncounter(req: Request, res: Response) {
  const data = tcmEncounterCreateSchema.parse(req.body);
  const encounter = await TcmEncounterModel.create({
    ...data,
    id: uuidv4(),
  });
  return res.status(httpStatus.CREATED).json(encounter);
}

export default router;
