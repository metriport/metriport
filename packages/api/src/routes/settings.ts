import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { z } from "zod";
import { createSettings } from "../command/settings/createSettings";
import { getSettings, getSettingsOrFail } from "../command/settings/getSettings";
import { updateSettings } from "../command/settings/updateSettings";
import { countFailedAndProcessingRequests } from "../command/webhook/count-failed";
import { retryFailedRequests } from "../command/webhook/retry-failed";
import BadRequestError from "../errors/bad-request";
import { Settings } from "../models/settings";
import { asyncHandler, getCxIdOrFail } from "./util";

const router = Router();
const webhookURLIncludeBlacklist = [
  "127.0.0.1",
  "127.1",
  "127.000.000.1",
  "localhost",
  "127.0.0.2",
  "0x7f.0x0.0x0.0x1",
  "0177.0.0.01",
  "01111111000000000000000000000001",
  "01111111.00000000.00000000.00000001",
  "2130706433",
  "017700000001",
  "%6c%6f%63%61%6c%68%6f%73%74",
  "0177.0.0.0x1",
  "169.254.169.254",
  "169.254.169.254/latest/meta-data/iam/security-credentials/",
  "169.254.169.254/latest/meta-data/hostname",
  "fuf.me",
  "localtest.me",
  "ulh.us",
  "127-0-0-1.org.uk",
  "ratchetlocal.com",
  "smackaho.st",
  "42foo.com",
  "vcap.me",
  "beweb.com",
  "yoogle.com",
  "ortkut.com",
  "feacebook.com",
  "lvh.me",
  "127.127.127.127",
  "127.0.0.0",
  "1.1.1.1 &@2.2.2.2# @3.3.3.3",
  "urllib: 3.3.3.3",
  "amazonaws.com",
  "[::]",
  "0000",
  "/internal", // limitation: cx can't use this route in their wh url - chances of this happening is low, but erring on the side of security here
];
const webhookURLExactBlacklist = ["0"];

class SettingsDTO {
  public constructor(
    public id: string,
    public webhookUrl: string | null,
    public webhookKey: string | null
  ) {}

  static fromEntity(s: Settings): SettingsDTO {
    return new SettingsDTO(s.id, s.webhookUrl, s.webhookKey);
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
 * @return {SettingsDTO} The customer settings data as defined by SettingsDTO.
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
  .strict();

/** ---------------------------------------------------------------------------
 * POST /settings
 *
 * Updates the settings for the API customer.
 *
 * @param {string}  req.body.webhookUrl The webhook URL to set.
 *
 * @return {SettingsDTO} The updated settings data as defined by SettingsDTO.
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const { webhookUrl } = updateSettingsSchema.parse(req.body);
    if (webhookUrl) {
      for (const blacklistedStr of webhookURLIncludeBlacklist) {
        if (webhookUrl.includes(blacklistedStr)) {
          throw new BadRequestError(`Invalid URL`);
        }
      }
      if (webhookURLExactBlacklist.includes(webhookUrl)) throw new BadRequestError(`Invalid URL`);
    }
    const settings = await updateSettings({
      cxId,
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
    const settings = await getSettingsOrFail({ id });
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
