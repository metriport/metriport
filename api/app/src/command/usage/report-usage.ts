import Axios from "axios";
import { Config } from "../../shared/config";
import { capture } from "../../shared/notifications";

const axios = Axios.create();

export enum ApiTypes {
  devices = "devices",
  medical = "medical",
}

export type ReportUsageCommand = {
  cxId: string;
  entityId: string;
  apiType: ApiTypes;
};

export const reportUsage = ({ cxId, entityId, apiType }: ReportUsageCommand): void => {
  const url = Config.getUsageUrl();
  if (!url) return;
  const payload = { cxId, entityId, apiType };

  // intentionally failing silently
  axios.post(`${url}`, payload).catch(err => {
    console.log(`Failed to report usage (${payload}): `, err.message);
    capture.error(err, { extra: payload });
  });
};
