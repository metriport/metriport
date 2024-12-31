import { CarequalityManagementAPI } from "@metriport/carequality-sdk";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, NotFoundError } from "@metriport/shared";
import { makeCarequalityManagementAPI } from "../../api";
import { CQDirectoryEntryData2 } from "../../cq-directory";
import { CqOrgLoader } from "./cq-org-loader";
import { parseCQOrganization } from "./parse-cq-organization";

export class CqOrgLoaderImpl implements CqOrgLoader {
  private readonly cq: CarequalityManagementAPI;
  constructor() {
    const localCqApi = makeCarequalityManagementAPI();
    if (!localCqApi) throw new Error("Carequality API not initialized");
    this.cq = localCqApi;
  }

  public async getCqOrg(oid: string): Promise<CQDirectoryEntryData2 | undefined> {
    const { log, debug } = out(`CQ getCqOrg - OID ${oid}`);

    try {
      const org = await this.cq.getOrganization(oid);
      debug(`resp getOrganization: `, () => JSON.stringify(org));
      if (!org) return undefined;
      return parseCQOrganization(org, this);
    } catch (error) {
      const msg = `Failure while getting Org @ CQ`;
      log(`${msg}. Org OID: ${oid}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          orgOid: oid,
          context: `cq.org.get`,
          error,
        },
      });
      throw error;
    }
  }

  public async getCqOrgOrFail(oid: string): Promise<CQDirectoryEntryData2> {
    const org = await this.getCqOrg(oid);
    if (!org) throw new NotFoundError("CQ Organization not found");
    return org;
  }
}
