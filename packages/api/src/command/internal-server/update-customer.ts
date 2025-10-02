import { InternalServerApi } from "@metriport/core/external/internal-server/client";
import { MetriportError } from "@metriport/shared";
import { Config } from "../../shared/config";

export type UpdateCustomerBillingProps = {
  childCxId: string;
  parentName: string;
};

export async function updateCustomerBillingToPointToParent({
  parentName,
  childCxId,
}: UpdateCustomerBillingProps): Promise<void> {
  const url = Config.getCxBillingUrl();
  if (!url) throw new MetriportError("CX_BILLING_URL not configured");

  const params = new URLSearchParams({ cxId: childCxId });
  const urlWithParams = `${url}/${parentName}?${params.toString()}`;
  const internalServerApi = new InternalServerApi();
  await internalServerApi.makeRequest("PUT", urlWithParams);
}
