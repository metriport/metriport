import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler } from "../../util";
import { tcmEncounterCreateSchema } from "../../medical/schemas/tcm-encounter";

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
    const encounter = await TcmEncounterModel.create({
      cxId: req.cxId ?? "",
      patientId: data.patientId,
      facilityName: data.facilityName,
      latestEvent: data.latestEvent,
      class: data.class,
      admitTime: new Date(data.admitTime),
      dischargeTime: data.dischargeTime ? new Date(data.dischargeTime) : null,
      clinicalInformation: data.clinicalInformation,
    });
    return res.status(httpStatus.CREATED).json(encounter);
  })
);

export default router;
