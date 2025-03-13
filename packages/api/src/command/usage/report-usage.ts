import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared";
import Axios from "axios";
import stringify from "json-stringify-safe";
import { Product } from "../../domain/product";
import { Config } from "../../shared/config";

const axios = Axios.create({ timeout: 20_000 });

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
  const { log } = out(`reportUsage cxId ${cxId}`);
  // intentionally asynchronous
  axios.post(`${url}`, payload).catch(error => {
    log(`Failed to report usage (${stringify(payload)}) to server ${url}: ${errorToString(error)}`);
    capture.error("Failed to report usage", { extra: { payload, error } });
  });
}
