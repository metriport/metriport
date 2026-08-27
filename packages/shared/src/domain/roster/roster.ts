import { BaseDomain } from "../base-domain";
import { RosterStatus } from "./roster-status";

export type Roster = BaseDomain & {
  cxId: string;
  /**
   * The source of the roster. This is the name of the service creating the roster.
   */
  source: string;
  /**
   * The type of the roster. This is the type of the roster within the source service (e.g., "weekly-backfill", "notifications").
   */
  type: string;
  /**
   * The status of the roster.
   */
  status: RosterStatus;
  data?: unknown;
};

export type RosterWithSize = Roster & { size: number };

export type CreateRosterCmd = Pick<Roster, "cxId" | "source" | "type" | "data"> &
  Partial<Pick<Roster, "status">>;

export type GetRosterCmd = Pick<Roster, "cxId"> & { rosterId: string };

export type DeleteRosterCmd = GetRosterCmd;

export type UpdateRosterCmd = GetRosterCmd & {
  status?: RosterStatus;
  data?: unknown;
  forceStatusUpdate?: boolean;
};

export type ListRostersCmd = Pick<Roster, "cxId"> &
  Partial<Pick<Roster, "source" | "type" | "status">> & {
    sortBy?: {
      column: "createdAt";
      order: "ASC" | "DESC";
    };
    limit?: number;
  };
