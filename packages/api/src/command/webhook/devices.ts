import stringify from "json-stringify-safe";
import { ConnectedUser, ProviderMap } from "../../models/connected-user";
import { WebhookRequest } from "../../models/webhook-request";
import { capture } from "../../shared/notifications";
import { getSettingsOrFail } from "../settings/getSettings";
import { ApiTypes, reportUsage as reportUsageCmd } from "../usage/report-usage";
import { processRequest } from "./webhook";
import { createWebhookRequest } from "./webhook-request";
import { ProviderOptions } from "../../shared/constants";

export const dapiWebhookType = [
  "devices.provider-connected",
  "devices.provider-disconnected",
  "devices.health-data",
] as const;
export type DAPIWebhookType = (typeof dapiWebhookType)[number];

export function isDAPIWebhookRequest(webhookRequest: WebhookRequest): boolean {
  return dapiWebhookType.map(String).includes(webhookRequest.type);
}

export const reportDevicesUsage = (cxId: string, cxUserIds: string[]): void => {
  const apiType = ApiTypes.devices;
  cxUserIds.forEach(cxUserId => reportUsageCmd({ cxId, entityId: cxUserId, apiType }));
};

/**
 * Sends an update to the CX about their user subscribing to a provider.
 *
 * Executed asynchronously, so it should treat errors w/o expecting it to be done upstream.
 *
 * @param connectedUser   The connected user
 * @param provider        The newly-connected provider
 * @param deviceIds       A list of newly-connected device IDs
 */
export const sendProviderConnected = async (
  connectedUser: ConnectedUser,
  provider: ProviderOptions,
  deviceIds?: string[]
): Promise<void> => {
  let webhookRequest;
  try {
    const { id: userId, cxId } = connectedUser;
    const providers = connectedUser?.providerMap ? Object.keys(connectedUser.providerMap) : [];

    const connectedDevices = getConnectedDevices(connectedUser);

    const payload = {
      users: [
        {
          userId,
          providers: [provider],
          connectedProviders: providers,
          devices: deviceIds,
          connectedDevices,
        },
      ],
    };
    const settings = await getSettingsOrFail({ id: cxId });

    webhookRequest = await createWebhookRequest({
      cxId,
      type: "devices.provider-connected",
      payload,
    });
    await processRequest(webhookRequest, settings);
  } catch (error) {
    console.log(
      `Failed to send provider connected WH - provider: ${provider}, ` +
        `user: ${connectedUser.id}, webhookRequest: ${stringify(webhookRequest)}` +
        `error: ${error}`
    );
    capture.error(error, {
      extra: { connectedUser, provider, context: `webhook.sendProviderConnected`, error },
      level: "error",
    });
  }
};

/**
 * Sends an update to the CX about their user disconnecting from a provider.
 * This will also be fired when the user's token is no longer valid and needs to be
 * programatically .
 *
 * Executed asynchronously, so it should treat errors w/o expecting it to be done upstream.
 */
export const sendProviderDisconnected = async (
  connectedUser: ConnectedUser,
  disconnectedProviders: string[]
): Promise<void> => {
  let webhookRequest;
  try {
    const { id: userId, cxId } = connectedUser;
    const providers = connectedUser?.providerMap ? Object.keys(connectedUser.providerMap) : [];
    const payload = {
      users: [{ userId, providers: disconnectedProviders, connectedProviders: providers }],
    };
    const settings = await getSettingsOrFail({ id: cxId });

    webhookRequest = await createWebhookRequest({
      cxId,
      type: "devices.provider-disconnected",
      payload,
    });
    await processRequest(webhookRequest, settings);
  } catch (error) {
    console.log(
      `Failed to send provider disconnected WH - providers: ${disconnectedProviders}, ` +
        `user: ${connectedUser.id}, webhookRequest: ${stringify(webhookRequest)}` +
        `error: ${error}`
    );
    capture.error(error, {
      extra: {
        connectedUser,
        providers: disconnectedProviders,
        context: `webhook.sendProviderDiconnected`,
        error,
      },
      level: "error",
    });
  }
};

/**
 * Gets the list of all connected devices for a user
 *
 * @param connectedUser
 * @returns
 */
function getConnectedDevices(connectedUser: ConnectedUser): { [x: string]: string[] }[] {
  const connectedDevices = [];
  if (connectedUser.providerMap) {
    const providerMap: ProviderMap = connectedUser.providerMap;

    for (const [key, value] of Object.entries(providerMap)) {
      if (value.connectedDeviceIds) {
        connectedDevices.push({ [key]: value.connectedDeviceIds });
      }
    }
  }

  return connectedDevices;
}
