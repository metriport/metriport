import { PatientLoader } from "../../../domain/patient/patient-loader";
import { CQOrgHydrated, getOrgChunksFromPos, getOrgsByPrio, OrgPrio } from "./get-orgs";

// Try to keep it even to make testing easier
export const defaultMaxOrgsToProcess = 350;

export type CoverageEnhancementParams = {
  cxId: string;
  orgOID: string;
  patientIds: string[];
  fromOrgChunkPos?: number;
  stopOnErrors?: boolean;
};

export abstract class CoverageEnhancer {
  protected readonly patientLoader: PatientLoader;
  protected readonly orgs: Record<OrgPrio, CQOrgHydrated[]>;
  protected readonly maxOrgsToProcess: number;

  constructor({
    patientLoader,
    orgs = getOrgsByPrio(),
    maxOrgsToProcess = defaultMaxOrgsToProcess,
  }: {
    patientLoader: PatientLoader;
    orgs?: Record<OrgPrio, CQOrgHydrated[]>;
    maxOrgsToProcess?: number;
  }) {
    this.patientLoader = patientLoader;
    this.orgs = orgs;
    this.maxOrgsToProcess = maxOrgsToProcess;
  }

  /**
   * Execute the Enhanced Coverage flow using CW's CQ bridge.
   *
   * @param cxId The customer ID
   * @param orgOID The OID of the customer's Org
   * @param patientIds The IDs of the patients to have coverage enhanced
   * @param fromOrgChunkPos The initial chunk of CQ orgs to start from (defaults to 0)
   */
  public abstract enhanceCoverage({
    cxId,
    orgOID,
    patientIds,
    fromOrgChunkPos,
  }: CoverageEnhancementParams): Promise<void>;

  protected async getCarequalityOrgs({
    cxId,
    patientIds,
    fromOrgChunkPos,
  }: {
    cxId: string;
    patientIds: string[];
    fromOrgChunkPos: number;
  }): Promise<ReturnType<typeof getOrgChunksFromPos>> {
    const orgs = await this.getOrgsForPatients(cxId, patientIds);
    return getOrgChunksFromPos({ fromPos: fromOrgChunkPos, orgs });
  }

  /**
   * Returns CQ Orgs for the given patient IDs, considering the Orgs' priorities, US states, and
   * the patients' states.
   */
  protected async getOrgsForPatients(cxId: string, patientIds: string[]): Promise<CQOrgHydrated[]> {
    const orgs: CQOrgHydrated[] = [];
    const states = await this.patientLoader.getStatesFromPatientIds(cxId, patientIds);

    // Definition of priority of orgs to be included in the CQ orgs list.
    // The order here matters!
    const orgRetrievers = [
      this.getHigh(orgs),
      this.getMedium(orgs, states, "Epic"),
      this.getMedium(orgs, states),
      this.getMedium(orgs),
      this.getLow(orgs, states, "Kno2"),
      this.getLow(orgs, states),
      this.getLow(orgs),
    ];

    for (const retrieveOrgs of orgRetrievers) {
      const remainingSpots = this.maxOrgsToProcess - orgs.length;
      if (remainingSpots <= 0) return orgs;
      const orgsToProcess = retrieveOrgs();
      orgs.push(...orgsToProcess.slice(0, remainingSpots));
    }
    console.log(`Got ${orgs.length} orgs`);
    return orgs;
  }

  protected getOrgsBy(
    prio: OrgPrio,
    orgsAlreadyIncluded: CQOrgHydrated[],
    states?: string[],
    gateway?: string
  ): () => CQOrgHydrated[] {
    return (): CQOrgHydrated[] => {
      const idsOfOrgsAlreadyIncluded = orgsAlreadyIncluded.map(o => o.id);
      const orgsByPrio = this.orgs[prio];
      const orgsNotIncluded = orgsByPrio.filter(o => !idsOfOrgsAlreadyIncluded.includes(o.id));
      const orgsByGateway = gateway
        ? orgsNotIncluded.filter(
            o => o.gateway.toLowerCase().trim() === gateway.toLowerCase().trim()
          )
        : orgsNotIncluded;
      const orgsByStates =
        states && states.length
          ? orgsByGateway.filter(o => o.states.some(s => states.includes(s)))
          : orgsByGateway;
      return orgsByStates;
    };
  }
  protected getHigh(orgs: CQOrgHydrated[]) {
    return this.getOrgsBy("high", orgs);
  }
  protected getMedium(orgs: CQOrgHydrated[], states?: string[], gateway?: string) {
    return this.getOrgsBy("medium", orgs, states, gateway);
  }
  protected getLow(orgs: CQOrgHydrated[], states?: string[], gateway?: string) {
    return this.getOrgsBy("low", orgs, states, gateway);
  }
}
