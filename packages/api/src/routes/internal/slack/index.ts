import { Router, Request, Response } from "express";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler } from "../../util";
import { z } from "zod";
import { sendToSlack, SlackMessage } from "@metriport/core/external/slack/index";
import { NO_CONTENT } from "http-status";

const router = Router();

router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const data = slackBodySchema.parse(req.body);

    const slackMessage: SlackMessage = {
      subject: data.subject,
      message: data.message,
      emoji: data.emoji ? data.emoji : undefined,
    };

    const webhookUrl = data.webhookUrl;

    await sendToSlack(slackMessage, webhookUrl);

    res.sendStatus(NO_CONTENT);
  })
);

export const slackBodySchema = z.object({
  subject: z.string().trim().min(1, "subject is required").max(40000),
  message: z.string().trim().min(1, "message is required").max(40000),
  emoji: z
    .string()
    .regex(/^:[a-z0-9_+.-]+:$/i, "emoji must look like :emoji_name:")
    .optional()
    .default(":peepo_doctor:"),
  webhookUrl: z
    .string()
    .url("webhookUrl must be a valid URL")
    .refine(u => /^https:\/\/hooks\.slack\.com\/services\//.test(u), "must be a Slack webhook URL"),
});

export default router;
