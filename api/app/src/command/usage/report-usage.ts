import Axios from "axios";
import { Config } from "../../shared/config";

const axios = Axios.create();

export type ReportUsageCommand = {
  cxId: string;
  cxUserId: string;
};

export const reportDevicesUsage = async ({ cxId, cxUserId }: ReportUsageCommand): Promise<void> => {
  const url = Config.getUsageUrl();
  if (!url) return;

  const payload = { cxId, cxUserId };

  await axios.post(`${url}/devices`, payload, { timeout: 1_000 });
};
