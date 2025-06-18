import { Op } from "sequelize";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { Pagination } from "../../pagination";

const DEFAULT_FILTER_DATE = new Date("2020-01-01T00:00:00.000Z");

export type ListTcmEncountersCmd = {
  cxId: string;
  after?: string;
  pagination: Pagination;
};

export async function listTcmEncounters({
  cxId,
  after,
  pagination,
}: ListTcmEncountersCmd): Promise<{
  items: TcmEncounterModel[];
  totalCount: number;
}> {
  const where: Record<string, unknown> = {
    cxId,
    admitTime: {
      [Op.gt]: DEFAULT_FILTER_DATE,
    },
  };

  if (after) {
    where.admitTime = {
      ...(where.admitTime as Record<string, unknown>),
      [Op.gt]: new Date(after),
    };
  }

  const { rows, count } = await TcmEncounterModel.findAndCountAll({
    where,
    limit: pagination.count + 1, // Get one extra to determine if there's a next page
    order: [["admitTime", "DESC"]],
  });

  return {
    items: rows,
    totalCount: count,
  };
}
