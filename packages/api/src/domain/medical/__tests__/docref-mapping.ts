import { faker } from "@faker-js/faker";
import { MedicalDataSource } from "@metriport/core/external/index";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { makeBaseDomain } from "../../__tests__/base-domain";
import { DocRefMapping, DocRefMappingCreate } from "../docref-mapping";

export const makeDocRefMappingCreate = (
  params: Partial<DocRefMapping> = {}
): DocRefMappingCreate => {
  return {
    cxId: params.cxId ?? faker.string.uuid(),
    patientId: params.patientId ?? uuidv7(),
    externalId: params.externalId ?? faker.string.uuid(),
    source: params.source ?? faker.helpers.arrayElement(Object.values(MedicalDataSource)),
  };
};
export const makeDocRefMapping = (params: Partial<DocRefMapping> = {}): DocRefMapping => {
  return {
    ...makeBaseDomain(params),
    id: params.id ?? uuidv7(),
    ...makeDocRefMappingCreate(params),
  };
};
