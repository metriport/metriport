import Axios from "axios";
import stringify from "json-stringify-safe";
import { Product } from "../../domain/product";
import { Config } from "../../shared/config";
import { capture } from "@metriport/core/util/capture";

const axios = Axios.create({ timeout: 20_000 });

export type ReportUsageCommand = {
  cxId: string;
  entityId: string;
  product: Product;
  docQuery?: boolean;
};

export const reportUsage = ({ cxId, entityId, product, docQuery }: ReportUsageCommand): void => {
  const url = Config.getUsageUrl();
  if (!url) return;
  const payload = { cxId, entityId, apiType: product, docQuery };

  // intentionally asynchronous
  axios.post(`${url}`, payload).catch(err => {
    console.log(`Failed to report usage (${stringify(payload)}) to server ${url}: `, err.message);
    capture.error(err, { extra: { payload, err } });
  });
};
