import { ProviderSource } from "@metriport/api-sdk";
import dayjs from "dayjs";
import { Dictionary, groupBy, union } from "lodash";
import { FitbitWebhook } from "../../mappings/fitbit";
import { FitbitCollectionTypes } from "../../mappings/fitbit/constants";
import { ConnectedUser } from "../../models/connected-user";
import { Constants } from "../../shared/constants";
import { ISO_DATE } from "../../shared/date";
import { errorToString } from "../../shared/log";
import { Util } from "../../shared/util";
import { getConnectedUserByTokenOrFail } from "../connected-user/get-connected-user";
import { getSettingsOrFail } from "../settings/getSettings";
import {
  DataType,
  WebhookDataPayloadWithoutMessageId,
  WebhookUserDataPayload,
  reportDevicesUsage,
} from "./devices";
import { processRequest } from "./webhook";
import { buildWebhookRequestData } from "./webhook-request";

interface Entry {
  cxId: string;
  userId: string;
  typedData: WebhookUserDataPayload;
}

type UserNotifications = {
  [fitbitUserId: string]: { collectionType: FitbitCollectionTypes; date: string }[];
};

const log = Util.log(`Fitbit Webhook`);

/**
 * Processes a Fitbit webhook by grouping the individual updates by Fitbit user ID, then mapping the data for each notification
 * and sending it to the customer
 *
 * @param data Fitbit webhook notification
 */
export const processData = async (data: FitbitWebhook): Promise<void> => {
  console.log(`Starting to process a Fitbit webhook: ${JSON.stringify(data)}`);

  const groupedNotifications = groupByUser(data);
  const dataMappedByConnectedUser = await mapDataByConnectedUser(groupedNotifications);
  const dataByCustomer = groupBy(dataMappedByConnectedUser, v => v.cxId);

  await createAndSendCustomerPayloads(dataByCustomer);
};

/**
 * Groups the individual updates within a webhook by Fitbit user ID
 *
 * @param data: FitbitWebhook
 * @returns UserNotifications
 */
function groupByUser(data: FitbitWebhook): UserNotifications {
  const groupedNotifications: UserNotifications = {};

  data.forEach(d => {
    if (!groupedNotifications[d.ownerId]) {
      groupedNotifications[d.ownerId] = [];
    }
    groupedNotifications[d.ownerId].push({
      collectionType: d.collectionType,
      date: d.date,
    });
  });
  return groupedNotifications;
}

/**
 * Gets the ConnectedUser and their access token by Fitbit user ID, then maps the data for each notification
 * and returns an array of entries to be sent to the customer
 *
 * @param groupedNotifications WH notifications grouped by Fitbit user ID
 * @returns
 */
async function mapDataByConnectedUser(groupedNotifications: UserNotifications): Promise<Entry[]> {
  const connectedUsersAndData: Entry[] = [];
  await Promise.allSettled(
    Object.entries(groupedNotifications).map(async ([fitbitUserId, notifications]) => {
      const connectedUser = await getConnectedUserByTokenOrFail(
        ProviderSource.fitbit,
        fitbitUserId
      );
      const accessToken = await Constants.PROVIDER_OAUTH2_MAP[ProviderSource.fitbit].getAccessToken(
        connectedUser
      );

      const userFitbitData: WebhookUserDataPayload = {};
      const res = await Promise.allSettled(
        notifications.map(async d => {
          const mappedData = await mapData(connectedUser, d.collectionType, d.date, accessToken);
          const entryKeys = Object.keys(mappedData) as DataType[];
          for (const key of entryKeys) {
            if (!userFitbitData[key]) {
              userFitbitData[key] = [];
            }
            userFitbitData[key] = union(userFitbitData[key], mappedData[key]);
          }
        })
      );

      const failed = res.filter(r => r.status === "rejected");
      if (failed.length > 0) {
        const msg = `Failed to map data on Fitbit Webhook`;
        log(msg, failed);
      }

      connectedUsersAndData.push({
        cxId: connectedUser.cxId,
        userId: connectedUser.id,
        typedData: userFitbitData,
      });
    })
  );

  return connectedUsersAndData;
}

/**
 * Creates and returns a payload with the data for each collection type
 * @param connectedUser ConnectedUser whose data is being mapped
 * @param collectionType Data collection type
 * @param startdate Start date of the data
 * @param accessToken Access token for the user
 *
 * @returns
 */
export const mapData = async (
  connectedUser: ConnectedUser,
  collectionType: FitbitCollectionTypes,
  startdate: string,
  accessToken: string
): Promise<WebhookUserDataPayload> => {
  const payload: WebhookUserDataPayload = {};
  const provider = Constants.PROVIDER_MAP[ProviderSource.fitbit];

  if (collectionType === "activities") {
    const activity = await provider.getActivityData(connectedUser, startdate, { accessToken });
    payload.activity = [activity];
  } else if (collectionType === "body") {
    const body = await provider.getBodyData(connectedUser, startdate, { accessToken });
    payload.body = [body];
  } else if (collectionType === "foods") {
    const nutrition = await provider.getNutritionData(connectedUser, startdate, { accessToken });
    payload.nutrition = [nutrition];
  } else if (collectionType === "sleep") {
    const sleep = await provider.getSleepData(connectedUser, dayjs(startdate).format(ISO_DATE), {
      accessToken,
    });
    payload.sleep = [sleep];
  } else if (collectionType === "userRevokedAccess") {
    // do nothing until issue #652 is resolved
  }

  return payload;
};

/**
 * Creates and sends payloads to each customer
 * @param dataByCustomer Dictionary of entries grouped by customer ID
 */
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
        const webhookRequestData = buildWebhookRequestData({
          cxId,
          type: "devices.health-data",
          payload,
        });
        // send it to the customer and update the request status
        await processRequest(webhookRequestData, settings);

        reportDevicesUsage(
          cxId,
          dataAndUserList.map(du => du.userId)
        );
      } catch (error) {
        log(`Failed to create and send customer payloads: ${errorToString(error)}`);
      }
    })
  );
}
