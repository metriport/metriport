import { Metadata } from "@metriport/api-sdk/devices/models/common/metadata";
import { Request } from "express";

import { getConnectedUserOrFail } from "../../command/connected-user/get-connected-user";
import { ConsumerHealthDataType, DAPIParams } from "../../providers/provider";
import { Constants, ProviderOptions } from "../../shared/constants";
import { capture } from "@metriport/core/util/notifications";
import { getRawParams } from "../../shared/raw-params";
import { getTimezoneIdFrom } from "../schemas/timezone-id";
import { getUserIdFrom } from "../schemas/user-id";
import { getCxIdOrFail, getDateOrFail } from "../util";

// TODO make one of this for each Type so we can avoid the potential type mismatching
// on the caller's side
export async function getProviderDataForType<T>(
  req: Request,
  type: ConsumerHealthDataType
): Promise<T[]> {
  const cxId = getCxIdOrFail(req);
  const userId = getUserIdFrom("query", req).orFail();
  const date = getDateOrFail(req);
  const params: DAPIParams = {
    timezoneId: getTimezoneIdFrom("query", req).optional(),
  };

  const rawParams = getRawParams(req);

  const connectedUser = await getConnectedUserOrFail({ id: userId, cxId });
  if (!connectedUser.providerMap) return [];

  // queue up requests for all of the user's connected providers that support
  // the specified data queries
  const requests: Promise<T>[] = [];
  for (const p of Object.keys(connectedUser.providerMap)) {
    const providerName = p as ProviderOptions; // not proud of this :/
    const provider = Constants.PROVIDER_MAP[providerName];
    if (provider.consumerHealthDataTypeSupported(type)) {
      requests.push(
        (
          Constants.PROVIDER_MAP[providerName][`get${type}Data`](
            connectedUser,
            date,
            params,
            rawParams
          ) as Promise<T>
        ).catch(error => {
          console.error(String(error));
          capture.error(error, {
            extra: {
              context: `getProviderDataForType`,
              additional: `${providerName}.${type}`,
              connectedUser,
              date,
              error,
            },
          });
          data.push({
            metadata: {
              date: date,
              source: providerName,
              error: "failed while fetching data",
            } as Metadata,
          } as T);
          throw error;
        })
      );
    }
  }

  // note that all errors should be handled by the requests themselves,
  // and marshalled into the appropriate model
  const results = await Promise.allSettled(requests);
  const data: T[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      data.push(result.value);
    }
  }
  return data;
}
