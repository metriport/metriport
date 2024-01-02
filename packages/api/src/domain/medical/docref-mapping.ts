import { MedicalDataSource } from "../../external";
import { BaseDomain, BaseDomainCreate } from "../base-domain";

export interface DocRefMappingCreate extends Omit<BaseDomainCreate, "id"> {
  externalId: string;
  cxId: string;
  patientId: string;
  requestId: string;
  source: MedicalDataSource;
}

export interface DocRefMapping extends BaseDomain, DocRefMappingCreate {}
