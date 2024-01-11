import { MedicalDataSource } from "@metriport/core/external/index";
import { BaseDomain, BaseDomainCreate } from "../base-domain";

export interface DocRefMappingCreate extends Omit<BaseDomainCreate, "id"> {
  externalId: string;
  cxId: string;
  patientId: string;
  source: MedicalDataSource;
}

export interface DocRefMapping extends BaseDomain, DocRefMappingCreate {}
