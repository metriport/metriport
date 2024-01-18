import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { ISO_DATE } from "@metriport/shared/common/date";
import AWS from "aws-sdk";
import dayjs from "dayjs";
import { uniq } from "lodash";
import { Organization } from "@metriport/core/domain/organization";
import { Config } from "../../../shared/config";
import { errorToString } from "../../../shared/log";
import { capture } from "@metriport/core/util/capture";
import { getOrganizationOrFail } from "../organization/get-organization";

const MIN_QUOTA_TO_NOTIFY = 1_000;

type Usage = { cxId: string; quotaUsed: number; quotaRemaining: number; quotaTotal: number };

export type CustomersWithLowQuota = Usage & { orgName: string };

const apiGw = new AWS.APIGateway({
  apiVersion: "2015-07-09",
  region: Config.getAWSRegion(),
});

/**
 * Check API Gateway quota for each API Key and send a notification if it's below a threshold.
 * Only the keys with some usage are returned from AWS.
 */
export async function checkApiQuota(): Promise<CustomersWithLowQuota[]> {
  const usage = await getUsage();
  if (usage.length < 1) {
    console.log(`No usage info returned for this run`);
    return [];
  }

  const notify = usage.filter(isLowerThanThreshold);
  if (notify.length < 1) {
    console.log(`Found usage, but nothing under the threshold (${MIN_QUOTA_TO_NOTIFY} requests)`);
    return [];
  }

  const orgs = await getOrgs(notify.map(n => n.cxId));

  const cxsWithLowQuota: CustomersWithLowQuota[] = notify.map(n => {
    const org = orgs.find(o => o.cxId === n.cxId);
    return {
      cxId: n.cxId,
      orgName: org?.data?.name ?? "n/a",
      quotaUsed: n.quotaUsed,
      quotaRemaining: n.quotaRemaining,
      quotaTotal: n.quotaTotal,
    };
  });

  console.log(`Found ${notify.length} API keys with low quota: ${JSON.stringify(notify)}`);
  capture.message(`Found API keys with low quota`, {
    extra: { notificationPayload: cxsWithLowQuota },
  });

  return cxsWithLowQuota;
}

function isLowerThanThreshold(usage: Usage): boolean {
  return usage.quotaRemaining < MIN_QUOTA_TO_NOTIFY;
}

async function getOrgs(cxIds: string[]): Promise<Organization[]> {
  const resultPromises = await Promise.allSettled(
    cxIds.map(async cxId => {
      try {
        return await getOrganizationOrFail({ cxId });
      } catch (error) {
        const msg = "Failed to get Organization data";
        console.log(`${msg} - cxId ${cxId}: ${errorToString(error)}`);
        capture.error(error, { extra: { msg, cxId, error } });
        throw error;
      }
    })
  );
  const successful = resultPromises.flatMap(p => (p.status === "fulfilled" ? p.value : []));
  return successful;
}

async function getUsage(): Promise<Usage[]> {
  const usagePlanId = Config.getApiGatewayUsagePlanId();
  if (!usagePlanId) return [];
  const today = dayjs().format(ISO_DATE);

  const usage = await apiGw.getUsage({ usagePlanId, startDate: today, endDate: today }).promise();
  if (!usage.items) {
    console.log(`No usage items found for this run`);
    return [];
  }

  const items = Object.entries(usage.items);
  const promises = items.map(async ([apiKey, usageRaw]) => {
    const key = await apiGw.getApiKey({ apiKey, includeValue: true }).promise();

    const dailyUsage = usageRaw[0];
    if (!dailyUsage) throw new MetriportError(`Missing dailyUsage`, undefined, { apiKey });
    const quotaUsed = dailyUsage[0];
    if (quotaUsed == null) throw new MetriportError(`Missing quotaUsed`, undefined, { apiKey });
    const quotaRemaining = dailyUsage[1];
    if (quotaRemaining == null)
      throw new MetriportError(`Missing quotaRemaining`, undefined, { apiKey });

    const quotaTotal = quotaUsed + quotaRemaining;
    const cxId =
      key.name && key.name.includes("base") ? key.name.split("base-")[1] : key.name ?? "n/a";

    return { cxId, quotaUsed, quotaRemaining, quotaTotal };
  });
  const resultPromises = await Promise.allSettled(promises);
  const successful = resultPromises.flatMap(p => (p.status === "fulfilled" ? p.value : []));
  const failed = resultPromises.flatMap(p => (p.status === "rejected" ? p.reason : []));
  if (failed.length > 0) {
    const msg = "Failed to get API GW usage";
    const amount = failed.length;
    const messages = uniq(failed);
    console.log(`${msg} (${amount}): ${messages.join("; ")}`);
    capture.message(msg, { extra: { amount, messages }, level: "info" });
  }
  return successful;
}
