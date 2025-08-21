import { InternalServerApi } from "@metriport/core/external/internal-server/client";
import stringify from "json-stringify-safe";
import { Product } from "../../domain/product";
import { Config } from "../../shared/config";
import { capture } from "../../shared/notifications";

export type ReportUsageCommand = {
  cxId: string;
  entityId: string;
  product: Product;
  docQuery?: boolean;
};

export function reportUsage({ cxId, entityId, product, docQuery }: ReportUsageCommand): void {
  const url = Config.getUsageUrl();

  if (!url) return;
  const payload = { cxId, entityId, apiType: product, docQuery };
  const internalServerApi = new InternalServerApi();

  // intentionally asynchronous
  internalServerApi.makeRequest("POST", url, payload).catch(err => {
    console.log(`Failed to report usage (${stringify(payload)}) to server ${url}: `, err.message);
    capture.error(err, { extra: { payload, err } });
  });
}
