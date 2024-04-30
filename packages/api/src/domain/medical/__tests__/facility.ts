import { faker } from "@faker-js/faker";
import { makeBaseDomain } from "../../__tests__/base-domain";
import { Facility, FacilityData, FacilityType, isOboFacility, makeFacilityOid } from "../facility";
import { makeAddressStrict } from "./location-address";
import { makeOrgNumber } from "./organization";

export const makeFacilityNumber = () => faker.number.int({ min: 0, max: 1_000_000 });

export function makeFacilityData(data: Partial<FacilityData> = {}): FacilityData {
  return {
    name: data.name ?? faker.string.sample(),
    npi: data.npi ?? faker.string.sample(),
    tin: data.tin ?? faker.string.sample(),
    active: data.active ?? faker.datatype.boolean(),
    address: makeAddressStrict(),
  };
}

function getNumberFromOid(oid?: string): number | undefined {
  if (!oid) return undefined;
  const oidParts = oid.split(".");
  return Number.parseInt(oidParts[oidParts.length - 1]);
}

export function makeFacility(params: Partial<Facility> = {}): Facility {
  const facilityNumber =
    params.facilityNumber ?? getNumberFromOid(params.oid) ?? makeFacilityNumber();
  const oid = params.oid ?? makeFacilityOid(makeOrgNumber(), facilityNumber);
  const type = params.type ?? faker.helpers.arrayElement(Object.values(FacilityType));
  const cqOboActive =
    params.cqOboActive !== undefined
      ? params.cqOboActive
      : isOboFacility(type)
      ? faker.datatype.boolean()
      : false;
  const cwOboActive =
    params.cwOboActive !== undefined
      ? params.cwOboActive
      : isOboFacility(type)
      ? faker.datatype.boolean()
      : false;
  return {
    ...makeBaseDomain(),
    ...(params.id ? { id: params.id } : {}),
    cxId: params.cxId ?? faker.string.uuid(),
    oid,
    facilityNumber,
    cqOboActive,
    cwOboActive,
    cqOboOid:
      params.cqOboOid !== undefined ? params.cqOboOid : cqOboActive ? faker.string.uuid() : null,
    cwOboOid:
      params.cwOboOid !== undefined ? params.cwOboOid : cwOboActive ? faker.string.uuid() : null,
    type,
    data: makeFacilityData(params.data),
  };
}
