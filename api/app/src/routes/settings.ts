import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { z } from "zod";
import { createSettings } from "../command/settings/createSettings";
import { getSettings } from "../command/settings/getSettings";
import { updateSettings } from "../command/settings/updateSettings";
import { countFailedAndProcessingRequests } from "../command/webhook/count-failed";
import { retryFailedRequests } from "../command/webhook/retry-failed";
import { Settings } from "../models/settings";
import { asyncHandler, getCxIdOrFail } from "./util";

const router = Router();

class SettingsDTO {
  public constructor(
    public id: string,
    public webhookUrl: string | null,
    public webhookKey: string | null,
    public webhookEnabled: boolean, // TODO remove
    public webhookStatusDetail: string | null // TODO remove
  ) {}

  static fromEntity(s: Settings): SettingsDTO {
    return new SettingsDTO(
      s.id,
      s.webhookUrl,
      s.webhookKey,
      s.webhookEnabled, // TODO remove
      s.webhookStatusDetail ?? null // TODO remove
    );
  }
}

class WebhookStatusDTO {
  public constructor(
    public webhookEnabled: boolean,
    public webhookStatusDetail: string | null,
    public webhookRequestsProcessing: number,
    public webhookRequestsFailed: number
  ) {}

  static fromEntity(
    webhookEnabled: boolean,
    webhookStatusDetail: string | null,
    amountRequestsProcessing: number,
    amountRequestsFailed: number
  ): WebhookStatusDTO {
    return new WebhookStatusDTO(
      webhookEnabled,
      webhookStatusDetail,
      amountRequestsProcessing,
      amountRequestsFailed
    );
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
    return res.status(status.OK).send(SettingsDTO.fromEntity(settings));
  })
);

const updateSettingsSchema = z
  .object({
    webhookUrl: z.string().url().or(z.literal("").nullable().optional()),
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
    const settings = await updateSettings({
      id,
      webhookUrl: webhookUrl ?? undefined,
    });
    res.status(status.OK).json(SettingsDTO.fromEntity(settings));
  })
);

/** ---------------------------------------------------------------------------
 * GET /settings/webhook
 *
 * Get webhook status information.
 *
 * @return {WebhookStatusDTO} The Webhook status information or empty body if no
 * no settings defined.
 */
router.get(
  "/webhook",
  asyncHandler(async (req: Request, res: Response) => {
    const id = getCxIdOrFail(req);
    const settings = await getSettings({ id });
    if (!settings) return res.status(status.OK).send({});
    const { processing, failure } = await countFailedAndProcessingRequests(id);
    res
      .status(status.OK)
      .json(
        WebhookStatusDTO.fromEntity(
          settings.webhookEnabled,
          settings.webhookStatusDetail,
          processing,
          failure
        )
      );
  })
);

/** ---------------------------------------------------------------------------
 * POST /settings/webhook/retry
 *
 * Retries failed webhook requests.
 *
 * @return {200} indicating retry being processed.
 */
router.post(
  "/webhook/retry",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    await retryFailedRequests(cxId);
    res.sendStatus(status.OK);
  })
);

export default router;
