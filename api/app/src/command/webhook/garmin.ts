import { MetriportData } from "@metriport/api/lib/devices/models/metriport-data";
import { chunk, groupBy } from "lodash";
import { getErrorMessage } from "../../errors";
import { TypedData, UserData } from "../../mappings/garmin";
import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
import { getConnectedUsers } from "../connected-user/get-connected-user";
import { getUserTokenByUAT } from "../cx-user/get-user-token";
import { getSettingsOrFail } from "../settings/getSettings";
import { ApiTypes } from "../usage/report-usage";
import { analytics, EventTypes } from "../../shared/analytics";
import {
  reportDevicesUsage,
  WebhookMetadataPayload,
  WebhookUserDataPayload,
  processRequest,
} from "./webhook";
import { Settings } from "../../models/settings";
import { createWebhookRequest } from "./webhook-request";

const log = Util.log(`Garmin Webhook`);

type WebhookDataPayload = {
  meta: WebhookMetadataPayload;
  users: WebhookUserPayload[];
};
type WebhookDataPayloadWithoutMessageId = Omit<WebhookDataPayload, "meta">;
type WebhookUserPayload = { id: string } & WebhookUserDataPayload;

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
          id: t.id,
        }));
        if (cxIdAndUserIdList.length < 1) {
          log(`Could not find account for UAT ${uat}`);
        }
        return { typedData: d.typedData, cxIdAndUserIdList };
      })
    );
    // Flatten the list so each item has one cxId/userId and one data record
    const dataByUser = dataWithListOfCxIdAndUserId.flatMap(v =>
      v.cxIdAndUserIdList.map(({ cxId, id }) => ({
        cxId,
        id,
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
            id: v.id,
            typedData: v.typedData,
          }));
          // split the list in chunks
          const chunks = chunk(dataAndUserList, 10);
          // transform each chunk into a payload
          const payloads = chunks.map(c => {
            // groups by user
            const dataByUser = groupBy(c, v => v.id);
            // now convert that into an array of WebhookUserPayload (all the data of a user for this chunk)
            const users: WebhookUserPayload[] = [];
            for (const id of Object.keys(dataByUser)) {
              const usersData = dataByUser[id].map(dbu => dbu.typedData);
              // for each user, group together data by type
              const usersDataByType = groupBy(usersData, ud => ud.type);
              const data: MetriportData[] = [];
              for (const type of Object.keys(usersDataByType)) {
                const dataOfType: TypedData<MetriportData>[] = usersDataByType[type];
                data.push(...dataOfType.map(d => d.data));
                users.push({
                  id: id,
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
              apiType: ApiTypes.devices,
            },
          });
          await processOneCustomer(cxId, settings, payloads);
          reportDevicesUsage(
            cxId,
            dataAndUserList.map(du => du.id)
          );
        } catch (err) {
          const msg = getErrorMessage(err);
          log(`Failed to process data of customer ${cxId}: ${msg}`);
          capture.error(err, {
            extra: { context: `webhook.processData.customer` },
          });
        }
      })
    );
  } catch (err) {
    log(`Error on processData: `, err);
    capture.error(err, {
      extra: { context: `webhook.processData.global` },
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
    const webhookRequest = await createWebhookRequest({ cxId, payload });
    // send it to the customer and update the request status
    const success = await processRequest(webhookRequest, settings);
    // give it some time to prevent flooding the customer
    if (success) await Util.sleep(Math.random() * 200);
  }
  return true;
};
