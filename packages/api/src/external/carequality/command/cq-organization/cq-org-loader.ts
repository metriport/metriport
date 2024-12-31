import { CQDirectoryEntryData2 } from "../../cq-directory";

export interface CqOrgLoader {
  getCqOrg(oid: string): Promise<CQDirectoryEntryData2 | undefined>;
  getCqOrgOrFail(oid: string): Promise<CQDirectoryEntryData2>;
}
