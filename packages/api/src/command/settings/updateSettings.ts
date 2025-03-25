import { limitStringLength } from "@metriport/shared";
import { nanoid } from "nanoid";
import { maxWebhookStatusLength } from "../../domain/settings";
import { processAsyncError } from "@metriport/core/util/error/shared";
import WebhookError from "../../errors/webhook";
import {
  Settings as SettingsModel,
  WEBHOOK_STATUS_BAD_RESPONSE,
  WEBHOOK_STATUS_OK,
} from "../../models/settings";
import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
import { errorToWhStatusDetails, sendTestPayload } from "../webhook/webhook";
import { getSettingsOrFail } from "./getSettings";
import { MrFilters } from "../../domain/settings";

const log = Util.log(`updateSettings`);

export type UpdateSettingsCommand = {
  cxId: string;
  webhookUrl?: string;
  filters?: MrFilters[];
};

export const updateSettings = async ({
  cxId,
  webhookUrl,
  filters,
}: UpdateSettingsCommand): Promise<SettingsModel> => {
  const originalSettings = await getSettingsOrFail({ id: cxId });
  const updateWebhook = getWebhookDataForUpdate(originalSettings, webhookUrl);
  await SettingsModel.update(
    {
      ...originalSettings.dataValues,
      ...(webhookUrl ? updateWebhook : undefined),
      ...(filters ? { mrFilters: filters } : undefined),
    },
    { where: { id: cxId } }
  );

  // if there's a URL, fire a test towards it - intentionally asynchronous
  updateWebhook.webhookUrl &&
    testWebhook({ cxId, ...updateWebhook }).catch(processAsyncError("Failed testing cx's webhook"));

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
  const statusDetail = limitStringLength(webhookStatusDetail, maxWebhookStatusLength);
  await SettingsModel.update(
    {
      webhookEnabled,
      ...(statusDetail ? { webhookStatusDetail: statusDetail } : undefined),
    },
    { where: { id: cxId } }
  );
};

const getWebhookDataForUpdate = (
  settings: SettingsModel,
  newUrl?: string
): Pick<SettingsModel, "webhookUrl" | "webhookKey"> => {
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
  return webhookData;
};

type TestWebhookCommand = Pick<SettingsModel, "webhookUrl" | "webhookKey"> & { cxId: string };

const testWebhook = async ({ cxId, webhookUrl, webhookKey }: TestWebhookCommand): Promise<void> => {
  if (!webhookUrl || !webhookKey) return;
  try {
    const testOK = await sendTestPayload(webhookUrl, webhookKey, cxId);
    await updateWebhookStatus({
      cxId,
      webhookEnabled: testOK,
      webhookStatusDetail: testOK ? WEBHOOK_STATUS_OK : WEBHOOK_STATUS_BAD_RESPONSE,
    });
  } catch (error) {
    if (error instanceof WebhookError) {
      const webhookStatusDetail = errorToWhStatusDetails(error);
      await updateWebhookStatus({
        cxId,
        webhookEnabled: false,
        webhookStatusDetail,
      });
    } else {
      log(`Unexpected error testing webhook: ${error}`);
      capture.error(error, {
        extra: {
          context: "testWebhook",
          cxId,
          webhookUrl,
          webhookKey,
          error,
        },
      });
    }
  }
};
