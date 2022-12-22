import { nanoid } from "nanoid";
import WebhookError from "../../errors/webhook";
import { Settings, WEBHOOK_STATUS_OK } from "../../models/settings";
import { Util } from "../../shared/util";
import { sendTestPayload } from "../../webhook";
import { getSettingsOrFail } from "./getSettings";

const log = Util.log(`updateSettings`);

export type UpdateSettingsCommand = {
  id: string;
  webhookUrl?: string;
};

export const updateSettings = async ({
  id,
  webhookUrl,
}: UpdateSettingsCommand): Promise<Settings> => {
  const originalSettings = await getSettingsOrFail({ id });
  const webhook = getWebhookDataForUpdate(originalSettings, webhookUrl);
  await Settings.update(
    {
      ...(webhook && {
        ...webhook,
        webhookStatus: null,
      }),
    },
    { where: { id } }
  );
  const updatedSettings = await getSettingsOrFail({ id });
  // intentionally asynchronous
  testWebhook(updatedSettings);
  return updatedSettings;
};

export type UpdateWebhookStatusCommand = {
  id: string;
  webhookStatus?: string;
};
export const updateWebhookStatus = async ({
  id,
  webhookStatus,
}: UpdateWebhookStatusCommand): Promise<void> => {
  await Settings.update({ webhookStatus }, { where: { id } });
};

const getWebhookDataForUpdate = (
  settings: Settings,
  newUrl?: string
): Pick<Settings, "webhookUrl" | "webhookKey"> | undefined => {
  if (!newUrl) return undefined;
  const key = settings.webhookKey ?? nanoid();
  return {
    webhookUrl: newUrl,
    webhookKey: key,
  };
};

type TestWebhookCommand = Pick<Settings, "id" | "webhookUrl" | "webhookKey">;

const testWebhook = async ({
  id,
  webhookUrl,
  webhookKey,
}: TestWebhookCommand): Promise<void> => {
  if (!webhookUrl || !webhookKey) return;
  try {
    await sendTestPayload(webhookUrl, webhookKey);
    await updateWebhookStatus({ id, webhookStatus: WEBHOOK_STATUS_OK });
  } catch (err) {
    if (err instanceof WebhookError) {
      const webhookStatus = err.underlyingError.message;
      await updateWebhookStatus({ id, webhookStatus });
    } else {
      log(`Unexpected error testing webhook`, err);
    }
  }
};
