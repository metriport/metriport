import { CQDirectoryEntryData } from "../../cq-directory";

export interface CqOrgLoader {
  getCqOrg(oid: string): Promise<CQDirectoryEntryData | undefined>;
  getCqOrgOrFail(oid: string): Promise<CQDirectoryEntryData>;
}
