import { faker } from "@faker-js/faker";
import { DeepNullable } from "ts-essentials";
import { FacilityCreate, FacilityType, isOboFacility } from "../../../../domain/medical/facility";
import { makeFacilityData } from "../../../../domain/medical/__tests__/facility";
import { makeBaseDomain } from "../../../../domain/__tests__/base-domain";

export function makeFacilityCreateCmd(
  params: Partial<DeepNullable<FacilityCreate>> & Partial<Pick<FacilityCreate, "data">> = {}
): FacilityCreate {
  const cqType = params.cqType !== undefined ? params.cqType : FacilityType.initiatorAndResponder;
  const cwType = params.cwType !== undefined ? params.cwType : FacilityType.initiatorAndResponder;
  const cqActive =
    params.cqActive !== undefined
      ? params.cqActive
      : cqType && isOboFacility(cqType)
      ? true
      : false;
  const cwActive =
    params.cwActive !== undefined
      ? params.cwActive
      : cwType && isOboFacility(cwType)
      ? true
      : false;

  const preResponse = {
    ...makeBaseDomain(),
    cxId: params.cxId ?? faker.string.uuid(),
    cqActive: cqActive ?? undefined,
    cwActive: cwActive ?? undefined,
    cqOboOid:
      params.cqOboOid != undefined ? params.cqOboOid : cqActive ? faker.string.uuid() : undefined,
    cwOboOid:
      params.cwOboOid != undefined ? params.cwOboOid : cwActive ? faker.string.uuid() : undefined,
    cwType: cwType ?? undefined,
    cqType: cqType ?? undefined,
    data: makeFacilityData(params.data),
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, eTag, createdAt, updatedAt, ...resp } = preResponse;
  return resp;
}

export function makeFacilityCreate(
  params: Partial<DeepNullable<FacilityCreate>> & Partial<Pick<FacilityCreate, "data">> = {}
): FacilityCreate {
  const cqType = params.cqType ?? FacilityType.initiatorAndResponder;
  const cwType = params.cwType ?? FacilityType.initiatorAndResponder;
  const cqActive =
    params.cqActive != undefined
      ? params.cqActive
      : cqType && isOboFacility(cqType)
      ? faker.datatype.boolean()
      : false;
  const cwActive =
    params.cwActive != undefined
      ? params.cwActive
      : cwType && isOboFacility(cwType)
      ? faker.datatype.boolean()
      : false;
  return {
    ...makeBaseDomain(),
    cxId: params.cxId ?? faker.string.uuid(),
    cqActive: cqActive,
    cwActive: cwActive,
    cqOboOid:
      params.cqOboOid !== undefined ? params.cqOboOid : cqActive ? faker.string.uuid() : null,
    cwOboOid:
      params.cwOboOid !== undefined ? params.cwOboOid : cwActive ? faker.string.uuid() : null,
    cwType,
    cqType,
    data: makeFacilityData(params.data),
  };
}
