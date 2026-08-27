import { faker } from "@faker-js/faker";
import { FacilityType } from "@metriport/core/domain/facility";
import { DeepNullable } from "ts-essentials";
import { makeBaseDomain } from "../../../../domain/__tests__/base-domain";
import { makeFacilityData } from "../../../../domain/medical/__tests__/facility";
import { FacilityCreate, isInitiatorOnly } from "../../../../domain/medical/facility";

export function makeFacilityCreateCmd(
  params: Partial<DeepNullable<FacilityCreate>> & Partial<Pick<FacilityCreate, "data">> = {}
): FacilityCreate {
  const type = params.type ?? FacilityType.initiatorAndResponder;
  const cqActive = params.cqActive ?? (type && isInitiatorOnly(type) ? true : false);
  const cwActive = params.cwActive ?? (type && isInitiatorOnly(type) ? true : false);

  const preResponse = {
    ...makeBaseDomain(),
    cxId: params.cxId ?? faker.string.uuid(),
    cqActive: cqActive ?? undefined,
    cwActive: cwActive ?? undefined,
    principalOid:
      params.principalOid != undefined
        ? params.principalOid
        : cqActive
        ? faker.string.uuid()
        : undefined,
    type,
    data: makeFacilityData(params.data),
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, eTag, createdAt, updatedAt, ...resp } = preResponse;
  return resp;
}

export function makeFacilityCreate(
  params: Partial<DeepNullable<FacilityCreate>> & Partial<Pick<FacilityCreate, "data">> = {}
): FacilityCreate {
  const type = params.type ?? FacilityType.initiatorAndResponder;
  const cqActive =
    params.cqActive != undefined
      ? params.cqActive
      : type && isInitiatorOnly(type)
      ? faker.datatype.boolean()
      : false;
  const cwActive =
    params.cwActive != undefined
      ? params.cwActive
      : type && isInitiatorOnly(type)
      ? faker.datatype.boolean()
      : false;
  return {
    ...makeBaseDomain(),
    cxId: params.cxId ?? faker.string.uuid(),
    cqActive: cqActive,
    cwActive: cwActive,
    principalOid:
      params.principalOid !== undefined
        ? params.principalOid
        : cqActive
        ? faker.string.uuid()
        : null,
    type,
    data: makeFacilityData(params.data),
  };
}
