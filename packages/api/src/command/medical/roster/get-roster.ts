import {
  GetRosterCmd,
  ListRostersCmd,
  NotFoundError,
  Roster,
  RosterWithSize,
} from "@metriport/shared";
import { Transaction } from "sequelize";
import { RosterModel } from "../../../models/medical/roster";
import { getRosterSize } from "./patient-roster/get-roster-size";

export type GetRosterCmdWithTxAndLock = GetRosterCmd & {
  transaction?: Transaction;
  lock?: boolean;
};

export async function getRosterModel({
  rosterId,
  cxId,
  transaction,
  lock,
}: GetRosterCmdWithTxAndLock): Promise<RosterModel | undefined> {
  const roster = await RosterModel.findOne({
    where: { id: rosterId, cxId },
    transaction,
    lock,
  });
  if (!roster) return undefined;
  return roster;
}

export async function getRosterModelOrFail({
  rosterId,
  cxId,
  transaction,
  lock,
}: GetRosterCmdWithTxAndLock): Promise<RosterModel> {
  const roster = await getRosterModel({ rosterId, cxId, transaction, lock });
  if (!roster) throw new NotFoundError(`Could not find roster`, undefined, { rosterId, cxId });
  return roster;
}

export async function getRoster({
  rosterId,
  cxId,
  transaction,
  lock,
}: GetRosterCmdWithTxAndLock): Promise<Roster | undefined> {
  const roster = await getRosterModel({ rosterId, cxId, transaction, lock });
  if (!roster) return undefined;
  return roster.dataValues;
}

export async function getRosterOrFail({
  rosterId,
  cxId,
  transaction,
  lock,
}: GetRosterCmdWithTxAndLock): Promise<Roster> {
  const roster = await getRosterModelOrFail({ rosterId, cxId, transaction, lock });
  return roster.dataValues;
}

export async function getCxIdFromRosterIdOrFail(rosterId: string): Promise<string> {
  const roster = await RosterModel.findOne({ where: { id: rosterId } });
  if (!roster) throw new NotFoundError(`Could not find roster`, undefined, { rosterId });
  return roster.dataValues.cxId;
}

export async function getRosterWithSize({ rosterId, cxId }: GetRosterCmd): Promise<RosterWithSize> {
  const [roster, size] = await Promise.all([
    getRosterOrFail({ rosterId, cxId }),
    getRosterSize({ rosterId, cxId }),
  ]);
  return { ...roster, size };
}

export async function listRosters({
  cxId,
  source,
  type,
  status,
  sortBy,
  limit,
}: ListRostersCmd): Promise<Roster[]> {
  const rosters = await RosterModel.findAll({
    where: {
      cxId,
      ...(source ? { source } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
    },
    ...(sortBy ? { order: [[sortBy.column, sortBy.order]] } : {}),
    ...(limit ? { limit } : {}),
  });
  return rosters.map(roster => roster.dataValues);
}

export async function getLatestRoster({
  cxId,
  source,
  type,
  status,
}: Omit<ListRostersCmd, "sortBy" | "limit">): Promise<Roster | undefined> {
  const rosters = await listRosters({
    cxId,
    source,
    type,
    status,
    sortBy: { column: "createdAt", order: "DESC" },
    limit: 1,
  });
  const roster = rosters[0];
  if (!roster) return undefined;
  return roster;
}
