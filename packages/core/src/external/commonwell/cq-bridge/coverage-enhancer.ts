export type CoverageEnhancementParams = {
  cxId: string;
  orgOID: string;
  patientIds: string[];
  fromOrgChunkPos?: number;
  stopOnErrors?: boolean;
};

export abstract class CoverageEnhancer {
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
}
