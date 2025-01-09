import { Organization } from "@medplum/fhirtypes";
import { NotFoundError } from "@metriport/shared";
import { makeCarequalityManagementAPIOrFail } from "../../api";

export class CachedCqOrgLoader {
  private cache: Record<string, Organization> = {};
  constructor(private readonly cq = makeCarequalityManagementAPIOrFail()) {}

  public async getCqOrg(oid: string): Promise<Organization | undefined> {
    const org = this.cache[oid];
    if (org) return org;
    return await this.cq.getOrganization(oid);
  }

  public async getCqOrgOrFail(oid: string): Promise<Organization> {
    const org = await this.getCqOrg(oid);
    if (!org) throw new NotFoundError("Organization not found");
    return org;
  }

  public async populate(orgs: Organization[]): Promise<void> {
    orgs.forEach(org => {
      if (!org.id) return;
      this.cache[org.id] = org;
    });
  }

  public clear(): void {
    this.cache = {};
  }
}
