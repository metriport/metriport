import { nanoid } from "nanoid";
import { processAsyncError } from "../../errors";
import WebhookError from "../../errors/webhook";
import { Settings, WEBHOOK_STATUS_BAD_RESPONSE, WEBHOOK_STATUS_OK } from "../../models/settings";
import { capture } from "@metriport/core/util/notifications";
import { Util } from "../../shared/util";
import { sendTestPayload } from "../webhook/webhook";
import { getSettingsOrFail } from "./getSettings";

const log = Util.log(`updateSettings`);

export type UpdateSettingsCommand = {
  cxId: string;
  webhookUrl?: string;
};

export const updateSettings = async ({
  cxId,
  webhookUrl,
}: UpdateSettingsCommand): Promise<Settings> => {
  const originalSettings = await getSettingsOrFail({ id: cxId });
  const updateWebhook = getWebhookDataForUpdate(originalSettings, cxId, webhookUrl);
  await Settings.update(
    {
      ...updateWebhook,
    },
    { where: { id: cxId } }
  );
  const updatedSettings = await getSettingsOrFail({ id: cxId });
  return updatedSettings;
};

export type UpdateWebhookStatusCommand = {
  cxId: string;
  webhookEnabled: boolean;
  webhookStatusDetail?: string;
};
export const updateWebhookStatus = async ({
  cxId,
  webhookEnabled,
  webhookStatusDetail,
}: UpdateWebhookStatusCommand): Promise<void> => {
  await Settings.update(
    {
      webhookEnabled,
      ...(webhookStatusDetail ? { webhookStatusDetail } : undefined),
    },
    { where: { id: cxId } }
  );
};

const getWebhookDataForUpdate = (
  settings: Settings,
  cxId: string,
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
  webhookData.webhookUrl &&
    testWebhook({ cxId, ...webhookData }).catch(processAsyncError(`testWebhook`));
  return webhookData;
};

type TestWebhookCommand = Pick<Settings, "webhookUrl" | "webhookKey"> & { cxId: string };

const testWebhook = async ({ cxId, webhookUrl, webhookKey }: TestWebhookCommand): Promise<void> => {
  if (!webhookUrl || !webhookKey) return;
  try {
    const testOK = await sendTestPayload(webhookUrl, webhookKey);
    await updateWebhookStatus({
      cxId,
      webhookEnabled: testOK,
      webhookStatusDetail: testOK ? WEBHOOK_STATUS_OK : WEBHOOK_STATUS_BAD_RESPONSE,
    });
  } catch (err) {
    if (err instanceof WebhookError) {
      await updateWebhookStatus({
        cxId,
        webhookEnabled: false,
        webhookStatusDetail: String(err.cause),
      });
    } else {
      log(`Unexpected error testing webhook: ${err}`);
      capture.error(err, {
        extra: {
          context: "testWebhook",
          cxId,
          webhookUrl,
          webhookKey,
          err,
        },
      });
    }
  }
};
