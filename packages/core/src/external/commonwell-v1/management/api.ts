import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

export type Member = {
  id: string;
  name: string;
};

export interface CommonWellManagementAPI {
  getBaseUrl(): string;

  getMember(params?: { timeout?: number; log?: typeof console.log }): Promise<Member | undefined>;

  getIncludeList(params: {
    oid: string;
    timeout?: number;
    log?: typeof console.log;
  }): Promise<string[]>;

  updateIncludeList(params: {
    oid: string;
    careQualityOrgIds: string[];
    timeout?: number;
    log?: typeof console.log | undefined;
    debug?: typeof console.log | undefined;
  }): Promise<void>;
}
