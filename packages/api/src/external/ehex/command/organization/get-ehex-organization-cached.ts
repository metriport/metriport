import { Organization } from "@medplum/fhirtypes";
import { EhexManagementApi } from "@metriport/ehex-sdk";

export class CachedEhexOrgLoader {
  private cache: Record<string, Organization> = {};
  constructor(private readonly ehex: EhexManagementApi) {}

  public async getEhexOrg(oid: string): Promise<Organization | undefined> {
    const cachedOrg = this.cache[oid];
    if (cachedOrg) return cachedOrg;
    const org = await this.ehex.getOrganization(oid);
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
