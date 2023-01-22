import { nanoid } from "nanoid";
import WebhookError from "../../errors/webhook";
import { Settings, WEBHOOK_STATUS_BAD_RESPONSE, WEBHOOK_STATUS_OK } from "../../models/settings";
import { Util } from "../../shared/util";
import { sendTestPayload } from "../webhook/webhook";
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
  const updateWebhook = getWebhookDataForUpdate(originalSettings, webhookUrl);
  await Settings.update(
    {
      ...updateWebhook,
    },
    { where: { id } }
  );
  const updatedSettings = await getSettingsOrFail({ id });
  return updatedSettings;
};

export type UpdateWebhookStatusCommand = {
  id: string;
  webhookEnabled: boolean;
  webhookStatusDetail?: string;
};
export const updateWebhookStatus = async ({
  id,
  webhookEnabled,
  webhookStatusDetail,
}: UpdateWebhookStatusCommand): Promise<void> => {
  await Settings.update(
    {
      webhookEnabled,
      ...(webhookStatusDetail ? { webhookStatusDetail } : undefined),
    },
    { where: { id } }
  );
};

const getWebhookDataForUpdate = (
  settings: Settings,
  newUrl?: string
): Pick<Settings, "webhookUrl" | "webhookKey"> => {
  const webhookData = {
    ...(newUrl
      ? {
          webhookUrl: newUrl,
          webhookKey: settings.webhookKey ?? nanoid(),
        }
      : {
          webhookUrl: null,
          webhookKey: null,
        }),
    webhookStatus: null,
  };
  // if there's a URL, fire a test towards it - intentionally asynchronous
  webhookData.webhookUrl && testWebhook({ id: settings.id, ...webhookData });
  return webhookData;
};

type TestWebhookCommand = Pick<Settings, "id" | "webhookUrl" | "webhookKey">;

const testWebhook = async ({ id, webhookUrl, webhookKey }: TestWebhookCommand): Promise<void> => {
  if (!webhookUrl || !webhookKey) return;
  try {
    const testOK = await sendTestPayload(webhookUrl, webhookKey);
    await updateWebhookStatus({
      id,
      webhookEnabled: testOK,
      webhookStatusDetail: testOK ? WEBHOOK_STATUS_OK : WEBHOOK_STATUS_BAD_RESPONSE,
    });
  } catch (err) {
    if (err instanceof WebhookError) {
      await updateWebhookStatus({
        id,
        webhookEnabled: false,
        webhookStatusDetail: err.underlyingError.message,
      });
    } else {
      log(`Unexpected error testing webhook`, err);
    }
  }
};
