import { ProviderSource } from "@metriport/api-sdk";
import { Product } from "../../domain/product";
import { ConnectedUser } from "../../models/connected-user";
import { analytics, EventTypes } from "../../shared/analytics";
import Provider from "../provider";

export type ExtraType = Record<string, string | undefined> & {
  action: keyof Provider;
};

/**
 * DAPI only!
 */
export async function executeAndReportAnalytics<R>(
  fnToExecute: () => Promise<R>,
  connectedUser: ConnectedUser,
  provider: ProviderSource,
  extra: ExtraType
): Promise<R> {
  const timeBefore = Date.now();

  const resp = await fnToExecute();

  const durationInMs = Date.now() - timeBefore;
  analytics({
    distinctId: connectedUser.cxId,
    event: EventTypes.query,
    properties: {
      metriportUserId: connectedUser.id,
      provider,
      duration: durationInMs,
      ...(extra ? extra : {}),
    },
    apiType: Product.devices,
  });
  return resp;
}
