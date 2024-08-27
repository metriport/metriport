export type Ehr = "athena";

export interface EhrAccess {
  cxId: string;
  /**
   * The mapped ID from the EHR to the Customer ID
   */
  ehrId: string;
  /**
   * The name / ID of the EHR
   */
  ehrName: Ehr;
}
