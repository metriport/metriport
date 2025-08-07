import { faker } from "@faker-js/faker";
import { ConsolidatedQuery } from "@metriport/api-sdk";
import { ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";

export function makeConsolidatedQueryProgress(
  params?: Partial<ConsolidatedQuery>
): ConsolidatedQuery {
  const dateTo = dayjs(faker.date.recent()).format(ISO_DATE);

  return {
    requestId: params?.requestId ?? faker.string.uuid(),
    status: params?.status ?? "processing",
    startedAt: params?.startedAt ?? new Date(),
    resources: params?.resources ?? [],
    conversionType: params?.conversionType ?? "json",
    dateFrom: dayjs(
      faker.date.past({
        refDate: dateTo,
      })
    ).format(ISO_DATE),
    dateTo,
  };
}
