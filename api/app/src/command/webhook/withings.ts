import dayjs from "dayjs";
import { ProviderSource } from "@metriport/api";
import { getConnectedUserByTokenOrFail } from "../connected-user/get-connected-user";
import { getSettingsOrFail } from "../settings/getSettings";
import { Constants } from "../../shared/constants";
import { ConnectedUser } from "../../models/connected-user";
import { createWebhookRequest } from "./webhook-request";
import { processRequest, WebhookUserDataPayload, reportUsage } from "./webhook";
import { capture } from "../../shared/notifications";

export type WithingsWebhook = {
  userid: string;
  date?: string;
  startdate?: string;
  enddate?: string;
  appli: string;
};

const activityCategory = "16";
const bodyCategory = "1";
const biometricsCategories = ["2", "4", "54", "58"];
const sleepCategory = "44";

export const processData = async (data: WithingsWebhook) => {
  const categoryNum = data.appli;
  const withingsUserId = data.userid;
  let startdate = "";

  if (data.startdate) {
    startdate = dayjs.unix(parseInt(data.startdate)).format();
  } else if (data.date) {
    startdate = data.date;
  }

  try {
    const connectedUser = await getConnectedUserByTokenOrFail(
      ProviderSource.withings,
      withingsUserId
    );

    const cxId = connectedUser.cxId;
    const cxUserId = connectedUser.cxUserId;

    const settings = await getSettingsOrFail({ id: cxId });
    const withingsData = await mapData(categoryNum, connectedUser, startdate);
    const payload = { users: [{ userId: cxUserId, ...withingsData }] };
    const webhookRequest = await createWebhookRequest({ cxId, payload });

    await processRequest(webhookRequest, settings);
    reportUsage(connectedUser.cxId, [connectedUser.cxUserId]);
  } catch (error) {
    capture.error(error, {
      extra: { context: `webhook.withings.processData` },
    });
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
    const activity = await provider.getActivityData(connectedUser, startdate);
    payload.activity = [activity];
  }

  if (categoryNum === bodyCategory) {
    const body = await provider.getBodyData(connectedUser, startdate);
    payload.body = [body];
  }

  if (biometricsCategories.includes(categoryNum)) {
    const biometrics = await provider.getBiometricsData(connectedUser, startdate);
    payload.biometrics = [biometrics];
  }

  if (categoryNum === sleepCategory) {
    const sleep = await provider.getSleepData(connectedUser, dayjs(startdate).format("YYYY-MM-DD"));
    payload.sleep = [sleep];
  }

  return payload;
};
