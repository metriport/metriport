import { ProviderSource } from "@metriport/api";
import { getConnectedUserByTokenOrFail } from "../connected-user/get-connected-user";
import { getSettingsOrFail } from "../settings/getSettings";
import { createWebhookRequest } from "./webhook-request";
import { processRequest, WebhookUserDataPayload, reportDevicesUsage } from "./webhook";
import dayjs from "dayjs";
import { ConnectedUser } from "../../models/connected-user";
import { Constants } from "../../shared/constants";
import { capture } from "../../shared/notifications";

export enum FitbitCollectionTypes {
  activities = "activities",
  body = "body",
  foods = "foods",
  sleep = "sleep",
  userRevokedAccess = "userRevokedAccess",
}

export type FitbitWebhookNotification = {
  collectionType: FitbitCollectionTypes;
  date: string;
  ownerId: string;
  ownerType: string;
  subscriptionId: string;
};

export const processData = async (data: Array<FitbitWebhookNotification>) => {
  console.log("Starting to process the webhook");

  for (const upd of data) {
    const { collectionType, date } = upd;
    const fitbitUserId = upd.ownerId;
    console.log("Collection type", collectionType, "for user", fitbitUserId, "on date", date);

    try {
      const connectedUser = await getConnectedUserByTokenOrFail(
        ProviderSource.fitbit,
        fitbitUserId
      );

      const cxId = connectedUser.cxId;

      const fitbitData = await mapData(collectionType, connectedUser, date);

      const payload = { users: [{ userId: connectedUser.id, ...fitbitData }] };

      const settings = await getSettingsOrFail({ id: cxId });
      const webhookRequest = await createWebhookRequest({ cxId, payload });
      await processRequest(webhookRequest, settings);

      reportDevicesUsage(connectedUser.cxId, [connectedUser.cxUserId]);
    } catch (error) {
      console.log("Fitbit webhook processing failed.", error);
      capture.error(error, {
        extra: { data, context: `webhook.fitbit.processData` },
      });
    }
  }
};

export const mapData = async (
  collectionType: string,
  connectedUser: ConnectedUser,
  startdate: string
): Promise<WebhookUserDataPayload> => {
  const payload: WebhookUserDataPayload = {};
  const provider = Constants.PROVIDER_MAP[ProviderSource.fitbit];

  if (collectionType === FitbitCollectionTypes.activities) {
    const activity = await provider.getActivityData(connectedUser, startdate);
    payload.activity = [activity];
  } else if (collectionType === FitbitCollectionTypes.body) {
    const body = await provider.getBodyData(connectedUser, startdate);
    payload.body = [body];
  } else if (collectionType === FitbitCollectionTypes.foods) {
    const nutrition = await provider.getNutritionData(connectedUser, startdate);
    payload.nutrition = [nutrition];
  } else if (collectionType === FitbitCollectionTypes.sleep) {
    const sleep = await provider.getSleepData(connectedUser, dayjs(startdate).format("YYYY-MM-DD"));
    payload.sleep = [sleep];
  }

  return payload;
};
