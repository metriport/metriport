import { MetriportData } from "@metriport/api-sdk/devices/models/metriport-data";
import { WebhookMetadata } from "@metriport/shared/medical";
import stringify from "json-stringify-safe";
import { Product } from "../../domain/product";
import { ConnectedUser } from "../../models/connected-user";
import { ProviderOptions } from "../../shared/constants";
import { errorToString } from "../../shared/log";
import { getSettingsOrFail } from "../settings/getSettings";
import { reportUsage as reportUsageCmd } from "../internal-server/report-usage";
import { processRequest } from "./webhook";
import { buildWebhookRequestData, WebhookRequestData } from "./webhook-request";

export type DataType = "activity" | "sleep" | "body" | "biometrics" | "nutrition";

export interface TypedData<T extends MetriportData> {
  type: DataType;
  data: T;
}

export type WebhookDataPayload = {
  meta: WebhookMetadata;
  users: WebhookUserPayload[];
};
export type WebhookDataPayloadWithoutMessageId = Omit<WebhookDataPayload, "meta">;
export type WebhookUserPayload = { userId: string } & WebhookUserDataPayload;

export type WebhookUserDataPayload = {
  [k in DataType]?: MetriportData[];
};

export function reportDevicesUsage(cxId: string, cxUserIds: string[]): void {
  const product = Product.devices;
  cxUserIds.forEach(cxUserId => reportUsageCmd({ cxId, entityId: cxUserId, product }));
}

/**
 * Sends an update to the CX about their user subscribing to a provider.
 *
 * Executed asynchronously, so it should treat errors w/o expecting it to be done upstream.
 *
 * @param connectedUser   The connected user
 * @param provider        The newly-connected provider
 * @param deviceIds       A list of newly-connected device IDs
 */
export async function sendProviderConnected(
  connectedUser: ConnectedUser,
  provider: ProviderOptions,
  deviceIds?: string[]
): Promise<void> {
  let webhookRequestData: WebhookRequestData | undefined;
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
    webhookRequestData = buildWebhookRequestData({
      cxId,
      type: "devices.provider-connected",
      payload,
    });
    await processRequest(webhookRequestData, settings);
  } catch (error) {
    console.log(
      `Failed to send provider connected WH - provider: ${provider}, ` +
        `user: ${connectedUser.id}, webhookRequest: ${stringify(webhookRequestData)}` +
        `error: ${errorToString(error)}`
    );
  }
}

/**
 * Sends an update to the CX about their user disconnecting from a provider.
 * This will also be fired when the user's token is no longer valid and needs to be
 * programatically .
 *
 * Executed asynchronously, so it should treat errors w/o expecting it to be done upstream.
 */
export async function sendProviderDisconnected(
  connectedUser: ConnectedUser,
  disconnectedProviders: string[]
): Promise<void> {
  let webhookRequestData: WebhookRequestData | undefined;
  try {
    const { id: userId, cxId } = connectedUser;
    const providers = connectedUser?.providerMap ? Object.keys(connectedUser.providerMap) : [];
    const payload = {
      users: [{ userId, providers: disconnectedProviders, connectedProviders: providers }],
    };
    const settings = await getSettingsOrFail({ id: cxId });

    webhookRequestData = buildWebhookRequestData({
      cxId,
      type: "devices.provider-disconnected",
      payload,
    });
    await processRequest(webhookRequestData, settings);
  } catch (error) {
    console.log(
      `Failed to send provider disconnected WH - providers: ${disconnectedProviders}, ` +
        `user: ${connectedUser.id}, webhookRequest: ${stringify(webhookRequestData)}` +
        `error: ${error}`
    );
  }
}

/**
 * Gets the list of all connected devices for a user
 *
 * @param connectedUser
 * @returns
 */
function getConnectedDevices(connectedUser: ConnectedUser): { [x: string]: string[] }[] {
  const connectedDevices = [];
  if (connectedUser.providerMap) {
    const providerMap = connectedUser.providerMap;

    for (const [key, value] of Object.entries(providerMap)) {
      if (value && value.connectedDeviceIds) {
        connectedDevices.push({ [key]: value.connectedDeviceIds });
      }
    }
  }

  return connectedDevices;
}
