import { Organization } from "@medplum/fhirtypes";
import { CarequalityManagementAPIFhir } from "@metriport/carequality-sdk";
import { executeAsynchronously } from "@metriport/core/util";
import { NotFoundError } from "@metriport/shared";
import { makeCarequalityManagementAPIFhir } from "../../api";
import { CQDirectoryEntryData } from "../../cq-directory";
import { CqOrgLoader } from "./cq-org-loader";
import { getParentOid } from "./get-parent-org";
import { parseCQOrganization, parseCQOrganizationSimplified } from "./parse-cq-organization";

const numberParallelRequestsToCq = 20;

export class CachedCqOrgLoader implements CqOrgLoader {
  private cache: Record<string, Organization> = {};
  private parsedCache: Record<string, CQDirectoryEntryData> = {};
  private readonly cq: CarequalityManagementAPIFhir;
  constructor() {
    this.cq = makeCarequalityManagementAPIFhir();
  }

  public async getCqOrgUnparsed(oid: string): Promise<Organization | undefined> {
    const orgFromCq = this.cache[oid] ?? (await this.cq.getOrganization(oid));
    if (!orgFromCq) return undefined;
    this.cache[oid] = orgFromCq;
    return orgFromCq;
  }

  public async getCqOrg(oid: string): Promise<CQDirectoryEntryData | undefined> {
    const orgFromCache = await this.getCqOrgUnparsed(oid);
    if (!orgFromCache) return undefined;
    const parsedOrg =
      oid === getParentOid(orgFromCache)
        ? parseCQOrganizationSimplified(orgFromCache)
        : await parseCQOrganization(orgFromCache, this);
    this.parsedCache[oid] = parsedOrg;
    return parsedOrg;
  }

  public async getCqOrgOrFail(oid: string): Promise<CQDirectoryEntryData> {
    const org = await this.getCqOrg(oid);
    if (!org) throw new NotFoundError("Organization not found");
    return org;
  }

  public async getCqOrgs(oids: string[]): Promise<CQDirectoryEntryData[]> {
    const orgs: CQDirectoryEntryData[] = [];
    await executeAsynchronously(
      oids,
      async oid => {
        const cqOrg = await this.getCqOrg(oid);
        if (cqOrg) orgs.push(cqOrg);
      },
      { numberOfParallelExecutions: numberParallelRequestsToCq, minJitterMillis: 20 }
    );
    return orgs;
  }

  public populate(orgs: Organization[]): void {
    orgs.forEach(org => {
      if (!org.id) return;
      this.cache[org.id] = org;
    });
  }

  public clear(): void {
    this.cache = {};
    this.parsedCache = {};
  }
}
