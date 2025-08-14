import { InternalServerApi } from "@metriport/core/external/internal-server/client";
import { Config } from "../../shared/config";

export type Props = {
  childCxId: string;
  parentName: string;
};

export async function updateCustomerBillingToPointToParent({
  parentName,
  childCxId,
}: Props): Promise<void> {
  const url = Config.getCxBillingUrl();
  if (!url) throw new Error("CX_BILLING_URL not configured");
  const urlWithParams = `${url}?cxId=${childCxId}&parentName=${parentName}`;

  const internalServerApi = new InternalServerApi();
  await internalServerApi.makeRequest("PUT", urlWithParams);
}
