import { QueryTypes, Sequelize } from "sequelize";
import { z } from "zod";

export type QueryReplacements = {
  cxId: string;
  patientId?: string;
  patientIds?: string[] | undefined;
  dateString?: string;
  yesterday?: string;
  today?: string;
};

export type BaseStatisticsProps = {
  sqlDBCreds: string;
  cxId: string;
  dateString?: string;
  patientIds?: string[];
};

export type StatisticsProps = BaseStatisticsProps & { patientIds: string[] };

export type QueryProps = {
  sequelize: Sequelize;
  baseQuery: string;
  cxId: string;
  dateString?: string | undefined;
  patientIds?: {
    ids: string[] | undefined;
    columnName?: string;
  };
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

export function getYesterdaysTimeFrame(): [string, string] {
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

export function calculateMapStats(patientMap: Map<string, number>): {
  numPatientsWithTargetAttribute: number;
  avgAttributePerPatient: number;
} {
  const numPatients = patientMap.size;

  let totalLinks = 0;
  patientMap.forEach(links => {
    totalLinks += links;
  });

  const averageLinks = totalLinks / numPatients;
  return {
    numPatientsWithTargetAttribute: numPatients,
    avgAttributePerPatient: parseFloat(averageLinks.toFixed(2)),
  };
}

function appendDateStringToQueryAndUpdateReplacements(
  query: string,
  dateString: string | undefined,
  replacements: QueryReplacements
): string {
  if (dateString) {
    query += ` and created_at>:dateString`;
    replacements.dateString = dateString;
  } else {
    const [yesterday, today] = getYesterdaysTimeFrame();
    query += ` and created_at between :yesterday and :today`;
    replacements.yesterday = yesterday;
    replacements.today = today;
  }
  return query;
}

function appendPatientIdsToQueryAndUpdateReplacements(
  query: string,
  patientIds: {
    ids: string[] | undefined;
    columnName?: string;
  },
  replacements: QueryReplacements
): string {
  const column = patientIds.columnName || "patient_id";
  if (patientIds && patientIds.ids && patientIds.ids.length > 0) {
    query += ` and ${column} in (:patientIds)`;
    replacements.patientIds = patientIds.ids;
  }
  return query;
}

export function updateQueryAndReplacements(
  query: string,
  cxId: string,
  dateString?: string | undefined,
  patientIds?: {
    ids: string[] | undefined;
    columnName?: string;
  }
): { query: string; replacements: QueryReplacements } {
  const replacements: QueryReplacements = {
    cxId: cxId,
  };
  query = appendDateStringToQueryAndUpdateReplacements(query, dateString, replacements);
  if (patientIds) {
    query = appendPatientIdsToQueryAndUpdateReplacements(query, patientIds, replacements);
  }
  query += ";";
  return { query, replacements };
}

export async function getQueryResults({
  sequelize,
  baseQuery,
  cxId,
  dateString,
  patientIds,
}: QueryProps) {
  const { query, replacements } = updateQueryAndReplacements(
    baseQuery,
    cxId,
    dateString,
    patientIds
  );

  const results = await sequelize.query(query, {
    replacements: replacements,
    type: QueryTypes.SELECT,
  });

  return results;
}

export const tableNameHeader = (tableName: string) => `-----${tableName}-----\n`;
