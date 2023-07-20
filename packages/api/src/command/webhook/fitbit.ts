import { ProviderSource } from "@metriport/api-sdk";
import dayjs from "dayjs";
import { Dictionary, groupBy, union } from "lodash";
import { FitbitWebhook } from "../../mappings/fitbit";
import { FitbitCollectionTypes } from "../../mappings/fitbit/constants";
import { ConnectedUser } from "../../models/connected-user";
import { EventTypes, analytics } from "../../shared/analytics";
import { Constants } from "../../shared/constants";
import { ISO_DATE } from "../../shared/date";
import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
import { getConnectedUserByTokenOrFail } from "../connected-user/get-connected-user";
import { getSettingsOrFail } from "../settings/getSettings";
import { ApiTypes } from "../usage/report-usage";
import {
  DataType,
  WebhookDataPayloadWithoutMessageId,
  WebhookUserDataPayload,
  processRequest,
} from "./webhook";
import { createWebhookRequest } from "./webhook-request";
import { reportDevicesUsage } from "./devices";

interface Entry {
  cxId: string;
  userId: string;
  typedData: WebhookUserDataPayload;
}

const log = Util.log(`Fitbit Webhook`);

export const processData = async (data: FitbitWebhook): Promise<void> => {
  console.log("Starting to process the webhook");

  const connectedUsersAndData = await Promise.all(
    data.map(async d => {
      const { collectionType, date, ownerId: fitbitUserId } = d;
      const connectedUser = await getConnectedUserByTokenOrFail(
        ProviderSource.fitbit,
        fitbitUserId
      );

      const userFitbitData = await mapData(collectionType, connectedUser, date);
      return { cxId: connectedUser.cxId, userId: connectedUser.id, typedData: userFitbitData };
    })
  );

  const reducedData: Entry[] = [];

  connectedUsersAndData.forEach(entry => {
    const existingUserIndex = reducedData.findIndex(
      item => item.cxId === entry.cxId && item.userId === entry.userId
    );

    if (existingUserIndex >= 0) {
      const entryKeys = Object.keys(entry.typedData) as DataType[];

      reducedData[existingUserIndex] = {
        ...reducedData[existingUserIndex],
        typedData: {
          ...reducedData[existingUserIndex].typedData,
          ...(entryKeys.includes("activity")
            ? {
                activity: union(
                  reducedData[existingUserIndex].typedData.activity,
                  entry.typedData.activity
                ),
              }
            : undefined),
          ...(entryKeys.includes("nutrition")
            ? {
                nutrition: union(
                  reducedData[existingUserIndex].typedData.nutrition,
                  entry.typedData.nutrition
                ),
              }
            : undefined),
          ...(entryKeys.includes("body")
            ? { body: union(reducedData[existingUserIndex].typedData.body, entry.typedData.body) }
            : undefined),
          ...(entryKeys.includes("sleep")
            ? {
                sleep: union(reducedData[existingUserIndex].typedData.sleep, entry.typedData.sleep),
              }
            : undefined),
        },
      };
    } else {
      reducedData.push(entry);
    }
  });

  const dataByCustomer = groupBy(reducedData, v => v.cxId);

  await createAndSendCustomerPayloads(dataByCustomer);
};

export const mapData = async (
  collectionType: FitbitCollectionTypes,
  connectedUser: ConnectedUser,
  startdate: string
): Promise<WebhookUserDataPayload> => {
  const payload: WebhookUserDataPayload = {};
  const provider = Constants.PROVIDER_MAP[ProviderSource.fitbit];

  if (collectionType === "activities") {
    const activity = await provider.getActivityData(connectedUser, startdate);
    payload.activity = [activity];
  } else if (collectionType === "body") {
    const body = await provider.getBodyData(connectedUser, startdate);
    payload.body = [body];
  } else if (collectionType === "foods") {
    const nutrition = await provider.getNutritionData(connectedUser, startdate);
    payload.nutrition = [nutrition];
  } else if (collectionType === "sleep") {
    const sleep = await provider.getSleepData(connectedUser, dayjs(startdate).format(ISO_DATE));
    payload.sleep = [sleep];
  } else if (collectionType === "userRevokedAccess") {
    // do nothing until issue #652 is resolved
  } else {
    capture.message(`Unrecognized Fitbit collection type.`, {
      extra: { context: "fitbit.webhook.mapData", collectionType, connectedUser },
    });
  }

  return payload;
};

async function createAndSendCustomerPayloads(dataByCustomer: Dictionary<Entry[]>) {
  await Promise.allSettled(
    Object.keys(dataByCustomer).map(async cxId => {
      try {
        const dataAndUserList = dataByCustomer[cxId].map(v => ({
          userId: v.userId,
          typedData: v.typedData,
        }));

        const transformedData = dataAndUserList.map(userData => {
          const { userId, typedData } = userData;
          return { userId, ...typedData };
        });

        const payload: WebhookDataPayloadWithoutMessageId = { users: transformedData };
        const settings = await getSettingsOrFail({ id: cxId });

        analytics({
          distinctId: cxId,
          event: EventTypes.query,
          properties: {
            method: "POST",
            url: "/webhook/fitbit",
            apiType: ApiTypes.devices,
          },
        });
        const webhookRequest = await createWebhookRequest({
          cxId,
          type: "devices.health-data",
          payload,
        });
        // send it to the customer and update the request status
        await processRequest(webhookRequest, settings);

        reportDevicesUsage(
          cxId,
          dataAndUserList.map(du => du.userId)
        );
      } catch (err) {
        log(`Error on processData: ${err}`);
        capture.error(err, {
          extra: { context: `webhook.processData.fitbit`, err },
        });
      }
    })
  );
}
