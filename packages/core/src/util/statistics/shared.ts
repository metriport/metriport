import { z } from "zod";

export type QueryReplacements = {
  cxId: string;
  patientId?: string;
  dateString?: string;
  yesterday?: string;
  today?: string;
};

export type StatisticsProps = {
  sqlDBCreds: string;
  cxId: string;
  patientId?: string;
  dateString?: string;
};

const documentReference = z.object({
  size: z.number().optional(),
  contentType: z.string().optional(),
  homeCommunityId: z.string().optional(),
});

type DocRef = z.infer<typeof documentReference>;

export function mergeMaps(targetMap: Map<string, number>, sourceMap: Map<string, number>) {
  sourceMap.forEach((value, key) => {
    const currentValue = targetMap.get(key) || 0;
    targetMap.set(key, currentValue + value);
  });
}

export const mapToString = (map: Map<string, number>) =>
  Array.from(map)
    .map(([key, value]) => `\t-${key}: ${value}`)
    .join("\n");

export function countContentTypes(docRefs: DocRef[]): Map<string, number> {
  const contentTypeMap = new Map<string, number>();
  docRefs.forEach(docRef => {
    const contentType = docRef.contentType;
    if (contentType) {
      const count = contentTypeMap.get(contentType) ?? 0;
      contentTypeMap.set(contentType, count + 1);
    }
  });

  return contentTypeMap;
}

export function getYesterdaysTimeFrame() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const todaysParts = now.toISOString().split("T");
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  const todaysDate = todaysParts[0]!;
  const todaysTime = todaysParts[1]!;

  const yesterdaysParts = yesterday.toISOString().split("T");
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  const yesterdaysDate = yesterdaysParts[0]!;
  const yesterdaysTime = yesterdaysParts[1]!;

  return [yesterdaysDate + " " + yesterdaysTime, todaysDate + " " + todaysTime];
}
