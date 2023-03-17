import Axios from "axios";
import { Config } from "../../shared/config";

const axios = Axios.create();

export enum ApiTypes {
  devices = "devices",
  medical = "medical",
}

export type ReportUsageCommand = {
  cxId: string;
  cxUserId: string;
  apiType: ApiTypes;
};

export const reportUsage = async ({
  cxId,
  cxUserId,
  apiType,
}: ReportUsageCommand): Promise<void> => {
  const url = Config.getUsageUrl();
  if (!url) return;

  const payload = { cxId, cxUserId };

  await axios.post(`${url}/${apiType}`, payload, { timeout: 1_000 });
};
