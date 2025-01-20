import { Organization } from "@medplum/fhirtypes";
import { makeCarequalityManagementApiOrFail } from "../../api";

export class CachedCqOrgLoader {
  private cache: Record<string, Organization> = {};
  constructor(private readonly cq = makeCarequalityManagementApiOrFail()) {}

  public async getCqOrg(oid: string): Promise<Organization | undefined> {
    const cachedOrg = this.cache[oid];
    if (cachedOrg) return cachedOrg;
    const org = await this.cq.getOrganization(oid);
    if (org) this.populate([org]);
    return org;
  }

  public populate(orgs: Organization[]): void {
    orgs.forEach(org => {
      if (!org.id) return;
      this.cache[org.id] = org;
    });
  }

  public clear(): void {
    this.cache = {};
  }
}
