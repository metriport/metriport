import { faker } from "@faker-js/faker";
import { FacilityType } from "@metriport/core/domain/facility";
import { FacilityModel } from "../../../models/medical/facility";
import { makeBaseDomain } from "../../__tests__/base-domain";
import { Facility, FacilityData, isInitiatorOnly, makeFacilityOid } from "../facility";
import { makeAddressStrict } from "./location-address";
import { makeOrgNumber } from "./organization";

export function makeFacilityNumber() {
  return faker.number.int({ min: 0, max: 1_000_000 });
}

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
  const type = params.type ?? FacilityType.initiatorAndResponder;
  const cqActive =
    params.cqActive !== undefined
      ? params.cqActive
      : isInitiatorOnly(type)
      ? faker.datatype.boolean()
      : false;
  const cwActive =
    params.cwActive !== undefined
      ? params.cwActive
      : isInitiatorOnly(type)
      ? faker.datatype.boolean()
      : false;
  const ehexActive =
    params.ehexActive !== undefined
      ? params.ehexActive
      : isInitiatorOnly(type)
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
    ehexActive,
    principalOid:
      params.principalOid !== undefined
        ? params.principalOid
        : type === FacilityType.initiatorOnly
        ? makeFacilityOid(makeOrgNumber(), makeFacilityNumber())
        : null,
    type,
    cqApproved: false,
    cwApproved: false,
    ehexApproved: false,
    data: makeFacilityData(params.data),
  };
}

export function makeFacilityModel(params?: Partial<FacilityModel>): FacilityModel {
  const facility = makeFacility(params) as unknown as FacilityModel;
  facility.dataValues = facility;
  facility.save = jest.fn();
  facility.update = jest.fn();
  facility.destroy = jest.fn();
  return facility;
}
