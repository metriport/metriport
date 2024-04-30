import { faker } from "@faker-js/faker";
import { DeepNullable } from "ts-essentials";
import { FacilityCreate, FacilityType, isOboFacility } from "../../../../domain/medical/facility";
import { makeFacilityData } from "../../../../domain/medical/__tests__/facility";
import { makeBaseDomain } from "../../../../domain/__tests__/base-domain";
import { FacilityCreateCmd } from "../create-facility";

export function makeFacilityCreateCmd(
  params: Partial<DeepNullable<FacilityCreateCmd>> & Partial<Pick<FacilityCreateCmd, "data">> = {}
): FacilityCreateCmd {
  const type =
    params.type !== undefined
      ? params.type
      : faker.helpers.arrayElement(Object.values(FacilityType));
  const cqOboActive =
    params.cqOboActive !== undefined
      ? params.cqOboActive
      : type && isOboFacility(type)
      ? true
      : false;
  const cwOboActive =
    params.cwOboActive !== undefined
      ? params.cwOboActive
      : type && isOboFacility(type)
      ? true
      : false;

  const preResponse = {
    ...makeBaseDomain(),
    cxId: params.cxId ?? faker.string.uuid(),
    cqOboActive: cqOboActive ?? undefined,
    cwOboActive: cwOboActive ?? undefined,
    cqOboOid:
      params.cqOboOid != undefined
        ? params.cqOboOid
        : cqOboActive
        ? faker.string.uuid()
        : undefined,
    cwOboOid:
      params.cwOboOid != undefined
        ? params.cwOboOid
        : cwOboActive
        ? faker.string.uuid()
        : undefined,
    type: type ?? undefined,
    data: makeFacilityData(params.data),
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, eTag, createdAt, updatedAt, ...resp } = preResponse;
  return resp;
}

export function makeFacilityCreate(
  params: Partial<DeepNullable<FacilityCreate>> & Partial<Pick<FacilityCreate, "data">> = {}
): FacilityCreate {
  const type = params.type ?? faker.helpers.arrayElement(Object.values(FacilityType));
  const cqOboActive =
    params.cqOboActive != undefined
      ? params.cqOboActive
      : type && isOboFacility(type)
      ? faker.datatype.boolean()
      : false;
  const cwOboActive =
    params.cwOboActive != undefined
      ? params.cwOboActive
      : type && isOboFacility(type)
      ? faker.datatype.boolean()
      : false;
  return {
    ...makeBaseDomain(),
    oid: params.oid ?? faker.string.uuid(),
    facilityNumber: params.facilityNumber ?? faker.number.int(),
    cxId: params.cxId ?? faker.string.uuid(),
    cqOboActive: cqOboActive,
    cwOboActive: cwOboActive,
    cqOboOid:
      params.cqOboOid !== undefined ? params.cqOboOid : cqOboActive ? faker.string.uuid() : null,
    cwOboOid:
      params.cwOboOid !== undefined ? params.cwOboOid : cwOboActive ? faker.string.uuid() : null,
    type,
    data: makeFacilityData(params.data),
  };
}
