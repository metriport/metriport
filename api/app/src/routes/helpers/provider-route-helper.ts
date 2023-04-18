import { Request } from "express";
import { Metadata } from "@metriport/api/lib/devices/models/common/metadata";

import { getConnectedUserOrFail } from "../../command/connected-user/get-connected-user";
import { ConsumerHealthDataType } from "../../providers/provider";
import { Constants, ProviderOptions } from "../../shared/constants";
import { getCxIdOrFail, getDateOrFail, getUserIdFromQueryOrFail } from "../util";
import { capture } from "../../shared/notifications";

// TODO make one of this for each Type so we can avoid the potential type mismatching
// on the caller's side
export async function getProviderDataForType<T>(
  req: Request,
  type: ConsumerHealthDataType
): Promise<T[]> {
  const cxId = getCxIdOrFail(req);
  const userId = getUserIdFromQueryOrFail(req);
  const date = getDateOrFail(req);
  const connectedUser = await getConnectedUserOrFail({ id: userId, cxId });
  if (!connectedUser.providerMap) return [];

  // queue up requests for all of the user's connected providers that support
  // the specified data queries
  const requests = [];
  const providers: string[] = [];
  for (const p of Object.keys(connectedUser.providerMap)) {
    const providerName = p as ProviderOptions; // not proud of this :/
    const provider = Constants.PROVIDER_MAP[providerName];
    if (provider.consumerHealthDataTypeSupported(type)) {
      providers.push(providerName);
      requests.push(
        Constants.PROVIDER_MAP[providerName][`get${type}Data`](connectedUser, date) as Promise<T>
      );
    }
  }

  // note that all errors should be handled by the requests themselves,
  // and marshalled into the appropriate model
  const results = await Promise.allSettled(requests);
  const data: T[] = [];
  let i = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      data.push(result.value);
    } else {
      console.error(result.reason);
      capture.error(result.reason, {
        extra: { context: `${providers[i]}.${type}` },
      });
      data.push({
        metadata: {
          date: date,
          source: providers[i],
          error: "failed while fetching data",
        } as Metadata,
      } as T);
    }
    i++;
  }
  return data;
}
