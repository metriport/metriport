import { faker } from "@faker-js/faker";
import { FacilityModel } from "../../../models/medical/facility";
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
  const cqType = params.cqType ?? FacilityType.initiatorAndResponder;
  const cwType = params.cwType ?? FacilityType.initiatorAndResponder;
  const cqActive =
    params.cqActive !== undefined
      ? params.cqActive
      : isOboFacility(cqType)
      ? faker.datatype.boolean()
      : false;
  const cwActive =
    params.cwActive !== undefined
      ? params.cwActive
      : isOboFacility(cwType)
      ? faker.datatype.boolean()
      : false;
  return {
    ...makeBaseDomain(),
    ...(params.id ? { id: params.id } : {}),
    cxId: params.cxId ?? faker.string.uuid(),
    oid,
    facilityNumber,
    cqActive,
    cwActive,
    cqOboOid:
      params.cqOboOid !== undefined ? params.cqOboOid : cqActive ? faker.string.uuid() : null,
    cwOboOid:
      params.cwOboOid !== undefined ? params.cwOboOid : cwActive ? faker.string.uuid() : null,
    cqType,
    cwType,
    data: makeFacilityData(params.data),
  };
}

export function makeFacilityModel(params?: Partial<FacilityModel>): FacilityModel {
  const facility = makeFacility(params);
  const model = new FacilityModel(facility);
  model.cqType = facility.cqType;
  model.cwType = facility.cwType;
  model.data = facility.data;
  return model;
}
