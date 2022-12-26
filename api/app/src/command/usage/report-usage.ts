import Axios from "axios";
import { Config } from "../../shared/config";

const axios = Axios.create();

export type ReportUsageCommand = {
  cxId: string;
  cxUserId: string;
};

export const reportUsage = async ({
  cxId,
  cxUserId,
}: ReportUsageCommand): Promise<void> => {
  const url = Config.getUsageUrl();
  if (!url) return;

  const payload = { cxId, cxUserId };

  await axios.post(url, payload, { timeout: 1_000 });
};
