import { ProviderSource } from "@metriport/api-sdk";
import dayjs from "dayjs";
import { chunk, groupBy, union } from "lodash";
import MetriportError from "../../errors/metriport-error";
import { FitbitCollectionTypes } from "../../mappings/fitbit/constants";
import { ConnectedUser } from "../../models/connected-user";
import { Constants } from "../../shared/constants";
import { capture } from "../../shared/notifications";
import { getConnectedUserByTokenOrFail } from "../connected-user/get-connected-user";
import { DataType, WebhookUserDataPayload } from "./webhook";

export type FitbitWebhookNotification = {
  collectionType: FitbitCollectionTypes;
  date: string;
  ownerId: string;
  ownerType: string;
  subscriptionId: string;
};

interface Entry {
  cxId: string;
  userId: string;
  typedData: WebhookUserDataPayload;
}

export const processData = async (data: FitbitWebhookNotification[]) => {
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

  console.log("USERS AND DATA", connectedUsersAndData);

  const reducedData: Entry[] = [];

  connectedUsersAndData.forEach(entry => {
    console.log("ENTRYLOG", entry);
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

  console.log("REDUCED DATA", JSON.stringify(reducedData, null, 2));

  // Group all the data records for the same cxId
  const dataByCustomer = groupBy(reducedData, v => v.cxId);
  console.log("DATA BY CUSTOMER", dataByCustomer);

  await Promise.allSettled(
    Object.keys(dataByCustomer).map(async cxId => {
      console.log("CXID", cxId);
      try {
        // flat list of each data record and its respective user
        const dataAndUserList = dataByCustomer[cxId].map(v => ({
          userId: v.userId,
          typedData: v.typedData,
        }));

        console.log("DATA AND USER", dataAndUserList);
        // split the list in chunks
        const chunks = chunk(dataAndUserList, 10);

        console.log("CHUNKS IS", JSON.stringify(chunks, null, 2));

        //         // let payloads: WebhookDataPayloadWithoutMessageId[] = [];

        //         chunks.forEach(piece => {
        //           console.log("CHUNK PIECE", piece);
        //           // const { userId, typedData } = piece;
        //         });

        //         // const payloads = chunks.map(c => {
        //         //   const users: WebhookUserPayload[] = [];

        //         //   const payload: WebhookDataPayloadWithoutMessageId = { users };
        //         //   return payload;
        //         // });

        //         // console.log("FINALLY, PAYLOADS", JSON.stringify(payloads, null, 2));

        //         // now that we have a all the chunks for one customer, process them
        //         // const settings = await getSettingsOrFail({ id: cxId });

        //         // analytics({
        //         //   distinctId: cxId,
        //         //   event: EventTypes.query,
        //         //   properties: {
        //         //     method: "POST",
        //         //     url: "/webhook/garmin",
        //         //     apiType: ApiTypes.devices,
        //         //   },
        //         // });
        //         // await processOneCustomer(cxId, settings, payloads);
        //         // reportDevicesUsage(
        //         //   cxId,
        //         //   dataAndUserList.map(du => du.userId)
        //         // );
      } catch (err) {
        console.log("ERROR IS", err);
      }
    })
  );

  // const { activity, sleep, body, nutrition } = reducedData[existingIndex].typedData;
  //     const td = entry.typedData;
  //     if (activity) td.activity ? td.activity.push(...activity) : (td.activity = activity);
  //     if (sleep) td.sleep ? td.sleep.push(...sleep) : (td.sleep = sleep);
  //     if (body) td.body ? td.body.push(...body) : (td.body = body);
  //     if (nutrition) td.nutrition ? td.nutrition.push(...nutrition) : (td.nutrition = nutrition);
};

// [
//   {
//     cxId: '89298638-b38c-4f18-a51e-7c82d113e1bb',
//     userId: 'c55e5f8c-4f3f-4723-83e4-df2ab8f732f7',
//     typedData: { body: [Array] }
//   },
//   {
//     cxId: '89298638-b38c-4f18-a51e-7c82d113e1bb',
//     userId: 'c55e5f8c-4f3f-4723-83e4-df2ab8f732f7',
//     typedData: { body: [Array] }
//   },
//   {
//     cxId: '89298638-b38c-4f18-a51e-7c82d113e1bb',
//     userId: 'c55e5f8c-4f3f-4723-83e4-df2ab8f732f7',
//     typedData: { body: [Array] }
//   },
//   {
//     cxId: '89298638-b38c-4f18-a51e-7c82d113e1bb',
//     userId: 'c55e5f8c-4f3f-4723-83e4-df2ab8f732f7',
//     typedData: { nutrition: [Array] }
//   },
//   {
//     cxId: '89298638-b38c-4f18-a51e-7c82d113e1bb',
//     userId: '5abab776-fd9c-4dfe-92fc-1246301ee5ab',
//     typedData: { sleep: [Array] }
//   }
// ]

// const dataWithListOfCxIdAndUserId = await Promise.all(
//   data.map(async d => {
//     const connectedUsers = await getConnectedUserByTokenOrFail(ProviderSource.fitbit, d.ownerId);

//     const cxIdAndUserIdList = connectedUsers.map(t => ({
//       cxId: t.cxId,
//       userId: t.id,
//     }));
//     return {typedData: d.typedData, cx}
//   })
// )

//   const cxGroupedData: { [cxId: string]: UserData[] } = {};

//   for (const update of data) {
//     const { collectionType, date, ownerId: fitbitUserId } = update;
//     let cxId: string | undefined;
//     const connectedUser = await getConnectedUserByTokenOrFail(ProviderSource.fitbit, fitbitUserId);

//     cxId = connectedUser.cxId;

//     const fitbitData = await mapData(collectionType, connectedUser, date);
//     console.log("FITBIT DATA UPDATE:", fitbitData);

//     if (!cxGroupedData[cxId]) cxGroupedData[cxId] = [];

//     let userFound = false;

//     cxGroupedData[cxId].forEach(user => {
//       if (user.userId === connectedUser.id) {
//         userFound = true;
//         if (fitbitData.activity)
//           user.typedData.activity
//             ? user.typedData.activity.push(...fitbitData.activity)
//             : (user.typedData.activity = fitbitData.activity);
//         if (fitbitData.sleep)
//           user.typedData.sleep
//             ? user.typedData.sleep.push(...fitbitData.sleep)
//             : (user.typedData.sleep = fitbitData.sleep);
//         if (fitbitData.body)
//           user.typedData.body
//             ? user.typedData.body.push(...fitbitData.body)
//             : (user.typedData.body = fitbitData.body);
//         if (fitbitData.nutrition)
//           user.typedData.nutrition
//             ? user.typedData.nutrition.push(...fitbitData.nutrition)
//             : (user.typedData.nutrition = fitbitData.nutrition);
//       }
//     });

//     if (!userFound) {
//       cxGroupedData[cxId].push({ userId: connectedUser.id, typedData: fitbitData });
//     }
//   }

//   console.log("GROUPED DATA", cxGroupedData);

//   for (const [cxId, payload] of Object.entries(cxGroupedData)) {
//     const settings = await getSettingsOrFail({ id: cxId });
//     console.log("PAYLOAD IS", payload);

//     const webhookRequest = await createWebhookRequest({
//       cxId,
//       payload: payload.map(p => p.typedData),
//     });
//     await processRequest(webhookRequest, settings);
//     reportDevicesUsage(
//       cxId,
//       payload.map(du => du.userId)
//     );
//   }
// };

// export const processData = async (data: FitbitWebhookNotification[]) => {
//   console.log("Starting to process the webhook");
//   const cxGroupedData: { [cxId: string]: UserData[] } = {};

//   for (const update of data) {
//     const { collectionType, date, ownerId: fitbitUserId } = update;
//     let cxId: string | undefined;
//     const connectedUser = await getConnectedUserByTokenOrFail(ProviderSource.fitbit, fitbitUserId);

//     cxId = connectedUser.cxId;

//     const fitbitData = await mapData(collectionType, connectedUser, date);
//     console.log("FITBIT DATA UPDATE:", fitbitData);

//     if (!cxGroupedData[cxId]) cxGroupedData[cxId] = [];

//     let userFound = false;

//     cxGroupedData[cxId].forEach(user => {
//       if (user.userId === connectedUser.id) {
//         userFound = true;
//         if (fitbitData.activity)
//           user.typedData.activity
//             ? user.typedData.activity.push(...fitbitData.activity)
//             : (user.typedData.activity = fitbitData.activity);
//         if (fitbitData.sleep)
//           user.typedData.sleep
//             ? user.typedData.sleep.push(...fitbitData.sleep)
//             : (user.typedData.sleep = fitbitData.sleep);
//         if (fitbitData.body)
//           user.typedData.body
//             ? user.typedData.body.push(...fitbitData.body)
//             : (user.typedData.body = fitbitData.body);
//         if (fitbitData.nutrition)
//           user.typedData.nutrition
//             ? user.typedData.nutrition.push(...fitbitData.nutrition)
//             : (user.typedData.nutrition = fitbitData.nutrition);
//       }
//     });

//     if (!userFound) {
//       cxGroupedData[cxId].push({ userId: connectedUser.id, typedData: fitbitData });
//     }
//   }

//   console.log("GROUPED DATA", cxGroupedData);

//   for (const [cxId, payload] of Object.entries(cxGroupedData)) {
//     const settings = await getSettingsOrFail({ id: cxId });
//     console.log("PAYLOAD IS", payload);

//     const webhookRequest = await createWebhookRequest({
//       cxId,
//       payload: payload.map(p => p.typedData),
//     });
//     await processRequest(webhookRequest, settings);
//     reportDevicesUsage(
//       cxId,
//       payload.map(du => du.userId)
//     );
//   }
// };

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
  } else {
    capture.message(`Unrecognized Fitbit collection type.`, {
      extra: { context: "fitbit.webhook.mapData", collectionType, connectedUser },
    });
    throw new MetriportError(`Unrecognized collection type in Fitbit webhooks mapData`, {
      additionalInfo: collectionType,
    });
  }

  return payload;
};
