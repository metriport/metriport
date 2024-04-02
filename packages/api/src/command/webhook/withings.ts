import { ProviderSource } from "@metriport/api-sdk";
import dayjs from "dayjs";
import { ConnectedUser } from "../../models/connected-user";
import { Constants } from "../../shared/constants";
import { getConnectedUserByTokenOrFail } from "../connected-user/get-connected-user";
import { getSettingsOrFail } from "../settings/getSettings";
import { reportDevicesUsage, WebhookUserDataPayload } from "./devices";
import { processRequest } from "./webhook";
import { buildWebhookRequestData } from "./webhook-request";

export type WithingsWebhook = {
  userid: string;
  date?: string;
  startdate?: string;
  enddate?: string;
  appli: string;
};

export const activityCategory = "16";
export const bodyCategory = "1";
export const biometricsCategories = ["2", "4", "54", "58"];
export const sleepCategory = "44";

export const processData = async (data: WithingsWebhook) => {
  const categoryNum = data.appli;
  const withingsUserId = data.userid;
  let startdate = "";

  if (data.startdate) {
    startdate = dayjs.unix(parseInt(data.startdate)).format("YYYY-MM-DD");
  } else if (data.date) {
    startdate = data.date;
  }

  try {
    const connectedUser = await getConnectedUserByTokenOrFail(
      ProviderSource.withings,
      withingsUserId
    );

    const cxId = connectedUser.cxId;
    const settings = await getSettingsOrFail({ id: cxId });
    const withingsData = await mapData(categoryNum, connectedUser, startdate);
    const payload = { users: [{ userId: connectedUser.id, ...withingsData }] };
    const webhookRequestData = buildWebhookRequestData({
      cxId,
      type: "devices.health-data",
      payload,
    });
    await processRequest(webhookRequestData, settings);
    reportDevicesUsage(connectedUser.cxId, [connectedUser.cxUserId]);
  } catch (error) {
    console.log(`Error on processWithingsData: ${error}`);
  }
};

export const mapData = async (
  categoryNum: string,
  connectedUser: ConnectedUser,
  startdate: string
): Promise<WebhookUserDataPayload> => {
  const payload: WebhookUserDataPayload = {};
  const provider = Constants.PROVIDER_MAP[ProviderSource.withings];

  if (categoryNum === activityCategory) {
    const activity = await provider.getActivityData(connectedUser, startdate, {});
    payload.activity = [activity];
  } else if (categoryNum === bodyCategory) {
    const body = await provider.getBodyData(connectedUser, startdate, {});
    payload.body = [body];
  } else if (biometricsCategories.includes(categoryNum)) {
    const biometrics = await provider.getBiometricsData(connectedUser, startdate, {});
    payload.biometrics = [biometrics];
  } else if (categoryNum === sleepCategory) {
    const sleep = await provider.getSleepData(
      connectedUser,
      dayjs(startdate).format("YYYY-MM-DD"),
      {}
    );
    payload.sleep = [sleep];
  }

  return payload;
};
