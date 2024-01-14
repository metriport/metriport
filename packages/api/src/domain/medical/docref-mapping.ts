import { MedicalDataSource } from "@metriport/core/external/index";
import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";

export interface DocRefMappingCreate extends Omit<BaseDomainCreate, "id"> {
  externalId: string;
  cxId: string;
  patientId: string;
  source: MedicalDataSource;
}

export interface DocRefMapping extends BaseDomain, DocRefMappingCreate {}
