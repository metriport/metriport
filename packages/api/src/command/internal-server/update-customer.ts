import { InternalServerApi } from "@metriport/core/external/internal-server/client";
import { MetriportError } from "@metriport/shared";
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
  if (!url) throw new MetriportError("CX_BILLING_URL not configured");

  const urlWithParams = `${url}/${parentName}?cxId=${childCxId}`;
  const internalServerApi = new InternalServerApi();
  await internalServerApi.makeRequest("PUT", urlWithParams);
}
