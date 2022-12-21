import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { Settings } from "../models/settings";
import { asyncHandler, getCxIdOrFail } from "./util";
import { z } from "zod";
import { updateSettings } from "../command/settings/updateSettings";
import { getSettings } from "../command/settings/getSettings";
import { createSettings } from "../command/settings/createSettings";

const router = Router();

class SettingsDTO {
  public constructor(public id: string, public webhookUrl: string | null) {}

  static fromEntity(s: Settings): SettingsDTO {
    return new SettingsDTO(s.id, s.webhookUrl);
  }
}

/**
 * ---------------------------------------------------------------------------
 * GET /settings
 *
 * Gets the settings for the API customer.
 *
 * @return  {Settings | null}   The customer settings, if they exist.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const id = getCxIdOrFail(req);
    let settings = await getSettings({ id });
    if (!settings) {
      settings = await createSettings({ id });
    }
    return res.status(status.OK).send(settings);
  })
);

const updateSettingsSchema = z
  .object({
    webhookUrl: z.string().url().nullable(),
  })
  .strict(); // only using strict bc this is our internal API

/** ---------------------------------------------------------------------------
 * POST /settings
 *
 * Updates the settings for the API customer.
 *
 * @param {string}  req.body.webhookUrl The webhook URL to set.
 *
 * @return  The updated settings data as defined by SettingsDTO.
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const id = getCxIdOrFail(req);
    const { webhookUrl } = updateSettingsSchema.parse(req.body);
    const settings = await updateSettings({ id, webhookUrl });
    res.status(status.OK).json(SettingsDTO.fromEntity(settings));
  })
);

export default router;
