import { Organization } from "@medplum/fhirtypes";
import { CarequalityManagementAPI } from "@metriport/carequality-sdk";
import { executeAsynchronously } from "@metriport/core/util";
import { NotFoundError } from "@metriport/shared";
import { makeCarequalityManagementAPI } from "../../api";
import { CQDirectoryEntryData2 } from "../../cq-directory";
import { CqOrgLoader } from "./cq-org-loader";
import { getParentOid } from "./get-parent-org";
import { parseCQOrganization } from "./parse-cq-organization";

const numberParallelRequestsToCq = 20;

export class CachedCqOrgLoader implements CqOrgLoader {
  private cache: Record<string, Organization> = {};
  private parsedCache: Record<string, CQDirectoryEntryData2> = {};
  private readonly cq: CarequalityManagementAPI;
  constructor() {
    const localCqApi = makeCarequalityManagementAPI();
    if (!localCqApi) throw new Error("Carequality API not initialized");
    this.cq = localCqApi;
  }

  public async getCqOrg(oid: string): Promise<CQDirectoryEntryData2 | undefined> {
    const orgFromCq = this.cache[oid] ?? (await this.cq.getOrganization(oid));
    if (!orgFromCq) return undefined;
    this.cache[oid] = orgFromCq;
    if (oid === getParentOid(orgFromCq)) return this.parsedCache[oid];
    const parsedOrg = await parseCQOrganization(orgFromCq, this);
    if (!parsedOrg) return undefined;
    this.parsedCache[oid] = parsedOrg;
    return parsedOrg;
  }

  public async getCqOrgOrFail(oid: string): Promise<CQDirectoryEntryData2> {
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
  public async populateByOids(oids: string[]): Promise<void> {
    await executeAsynchronously(
      oids,
      async oid => {
        const orgFromCache = this.cache[oid];
        if (orgFromCache) return;
        const orgFromCq = await this.cq.getOrganization(oid);
        if (!orgFromCq) return;
        this.cache[oid] = orgFromCq;
      },
      {
        numberOfParallelExecutions: numberParallelRequestsToCq,
        minJitterMillis: 20,
        maxJitterMillis: 40,
      }
    );
  }

  public clear(): void {
    this.cache = {};
    this.parsedCache = {};
  }
}
