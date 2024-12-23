import { CarequalityManagementAPIFhir } from "@metriport/carequality-sdk";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, NotFoundError } from "@metriport/shared";
import { makeCarequalityManagementAPIFhir } from "../../api";
import { CQDirectoryEntryData } from "../../cq-directory";
import { CqOrgLoader } from "./cq-org-loader";
import { getParentOid } from "./get-parent-org";
import { parseCQOrganization, parseCQOrganizationSimplified } from "./parse-cq-organization";

export class CqOrgLoaderImpl implements CqOrgLoader {
  private readonly cq: CarequalityManagementAPIFhir;
  constructor() {
    this.cq = makeCarequalityManagementAPIFhir();
  }

  public async getCqOrg(oid: string): Promise<CQDirectoryEntryData | undefined> {
    const { log, debug } = out(`CQ getCqOrg - OID ${oid}`);

    try {
      const org = await this.cq.getOrganization(oid);
      debug(`resp getOrganization: `, () => JSON.stringify(org));
      const parsedOrg =
        oid === getParentOid(org)
          ? parseCQOrganizationSimplified(org)
          : await parseCQOrganization(org, this);
      return parsedOrg;
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

  public async getCqOrgOrFail(oid: string): Promise<CQDirectoryEntryData> {
    const org = await this.getCqOrg(oid);
    if (!org) throw new NotFoundError("Organization not found");
    return org;
  }
}
