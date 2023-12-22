import { MetriportData } from "@metriport/api-sdk/devices/models/metriport-data";
import { chunk, groupBy } from "lodash";
import { Product } from "../../domain/product";
import { getErrorMessage } from "../../errors";
import { UserData } from "../../mappings/garmin";
import { Settings } from "../../models/settings";
import { analytics, EventTypes } from "../../shared/analytics";
import { errorToString } from "../../shared/log";
import { capture } from "@metriport/core/util/capture";
import { Util } from "../../shared/util";
import { getConnectedUsers } from "../connected-user/get-connected-user";
import { getUserTokenByUAT } from "../cx-user/get-user-token";
import { getSettingsOrFail } from "../settings/getSettings";
import {
  reportDevicesUsage,
  TypedData,
  WebhookDataPayloadWithoutMessageId,
  WebhookUserPayload,
} from "./devices";
import { processRequest } from "./webhook";
import { createWebhookRequest } from "./webhook-request";

const log = Util.log(`Garmin Webhook`);

/**
 * Does the bulk of processing webhook incoming data, including storing and sending
 * to Customers/accounts.
 *
 * @param {UserData} data The data coming from a Provider, already converted to our internal format
 */
export const processData = async <T extends MetriportData>(data: UserData<T>[]): Promise<void> => {
  try {
    // the same Garmin user/UAT might be associated with multiple Metriport Customers
    // convert "data + UAT" into "data + list of users/customers"
    const dataWithListOfCxIdAndUserId = await Promise.all(
      data.map(async d => {
        const uat = d.user.userAccessToken;
        const userTokens = await getUserTokenByUAT({
          oauthUserAccessToken: uat,
        });
        const connectedUsers = (
          await Promise.all(
            userTokens.map(async ut => {
              // not setting user on capture bc this is running in parallel/asynchronously
              return getConnectedUsers({
                cxId: ut.cxId,
                ids: [ut.userId],
              });
            })
          )
        ).flatMap(u => u);
        const cxIdAndUserIdList = connectedUsers.map(t => ({
          cxId: t.cxId,
          userId: t.id,
        }));
        if (cxIdAndUserIdList.length < 1) {
          log(`Could not find account for UAT ${uat}`);
        }
        return { typedData: d.typedData, cxIdAndUserIdList };
      })
    );
    // Flatten the list so each item has one cxId/userId and one data record
    const dataByUser = dataWithListOfCxIdAndUserId.flatMap(v =>
      v.cxIdAndUserIdList.map(({ cxId, userId }) => ({
        cxId,
        userId,
        typedData: v.typedData,
      }))
    );
    // Group all the data records for the same cxId
    const dataByCustomer = groupBy(dataByUser, v => v.cxId);
    // Process all data for the same Customer in one Promise, run all in parallel
    await Promise.allSettled(
      Object.keys(dataByCustomer).map(async cxId => {
        try {
          // flat list of each data record and its respective user
          const dataAndUserList = dataByCustomer[cxId].map(v => ({
            userId: v.userId,
            typedData: v.typedData,
          }));
          // split the list in chunks
          const chunks = chunk(dataAndUserList, 10);
          // transform each chunk into a payload
          const payloads = chunks.map(c => {
            // groups by user
            const dataByUser = groupBy(c, v => v.userId);
            // now convert that into an array of WebhookUserPayload (all the data of a user for this chunk)
            const users: WebhookUserPayload[] = [];
            for (const id of Object.keys(dataByUser)) {
              const usersData = dataByUser[id].map(dbu => dbu.typedData);
              const userId = dataByUser[id].map(dbu => dbu.userId)[0];
              // for each user, group together data by type
              const usersDataByType = groupBy(usersData, ud => ud.type);
              const data: MetriportData[] = [];
              for (const type of Object.keys(usersDataByType)) {
                const dataOfType: TypedData<MetriportData>[] = usersDataByType[type];
                data.push(...dataOfType.map(d => d.data));
                users.push({
                  userId,
                  [type]: data,
                });
              }
            }
            const payload: WebhookDataPayloadWithoutMessageId = { users };
            return payload;
          });
          // now that we have a all the chunks for one customer, process them
          const settings = await getSettingsOrFail({ id: cxId });

          analytics({
            distinctId: cxId,
            event: EventTypes.query,
            properties: {
              method: "POST",
              url: "/webhook/garmin",
              apiType: Product.devices,
            },
          });
          await processOneCustomer(cxId, settings, payloads);
          reportDevicesUsage(
            cxId,
            dataAndUserList.map(du => du.userId)
          );
        } catch (error) {
          const msg = getErrorMessage(error);
          log(`Failed to process data of customer ${cxId}: ${msg}`);
          capture.error(error, {
            extra: { context: `webhook.processData.customer`, error, cxId },
          });
        }
      })
    );
  } catch (error) {
    log(`Error on processData: ${errorToString(error)}`);
    capture.error(error, {
      extra: { context: `webhook.processData.global`, error },
    });
  }
};

const processOneCustomer = async (
  cxId: string,
  settings: Settings,
  payloads: WebhookDataPayloadWithoutMessageId[]
): Promise<boolean> => {
  for (const payload of payloads) {
    // create a representation of this request and store on the DB
    const webhookRequest = await createWebhookRequest({
      cxId,
      type: "devices.health-data",
      payload,
    });
    // send it to the customer and update the request status
    const success = await processRequest(webhookRequest, settings);
    // give it some time to prevent flooding the customer
    if (success) await Util.sleep(Math.random() * 200);
  }
  return true;
};
