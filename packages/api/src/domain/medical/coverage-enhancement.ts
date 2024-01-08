import { BaseDomainCreate } from "../base-domain";

type Base = Omit<BaseDomainCreate, "id">;

export type CoverageEnhancementData = {
  cqOrgIds: string[];
  docsFound?: number;
};

export interface CoverageEnhancementCreate extends Base {
  ecId: string;
  cxId: string;
  patientId: string;
  data: CoverageEnhancementData;
}

//eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CoverageEnhancementUpdate extends CoverageEnhancementCreate {}

//eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CoverageEnhancement extends Base, CoverageEnhancementCreate {}
