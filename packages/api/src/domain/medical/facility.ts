import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { AddressStrict } from "./location-address";

export type FacilityData = {
  name: string;
  npi: string;
  tin?: string;
  active?: boolean;
  address: AddressStrict;
};

export interface FacilityCreate extends BaseDomainCreate {
  cxId: string;
  data: FacilityData;
}
export interface Facility extends BaseDomain, FacilityCreate {}
