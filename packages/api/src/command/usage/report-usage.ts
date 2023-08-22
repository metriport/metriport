import Axios from "axios";
import { Product } from "../../domain/product";
import { Config } from "../../shared/config";
import { capture } from "../../shared/notifications";

const axios = Axios.create({ timeout: 20_000 });

export type ReportUsageCommand = {
  cxId: string;
  entityId: string;
  product: Product;
};

export const reportUsage = ({ cxId, entityId, product }: ReportUsageCommand): void => {
  const url = Config.getUsageUrl();
  if (!url) return;
  const payload = { cxId, entityId, apiType: product };

  // intentionally asynchronous
  axios.post(`${url}`, payload).catch(err => {
    console.log(`Failed to report usage (${payload}): `, err.message);
    capture.error(err, { extra: { payload, err } });
  });
};
