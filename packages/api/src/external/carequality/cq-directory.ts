import { Organization as FhirOrganization } from "@medplum/fhirtypes";
import { Organization } from "@metriport/carequality-sdk/models/organization";
import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";

export type CQDirectoryEntryData = {
  id: string; // Organization's OID
  name?: string;
  urlXCPD?: string;
  urlDQ?: string;
  urlDR?: string;
  lat?: number;
  lon?: number;
  addressLine?: string;
  city?: string;
  state?: string;
  zip?: string;
  // TODO  2553 Update data to be of type FhirOrganization
  data?: Organization;
  point?: string;
  managingOrganization?: string;
  managingOrganizationId?: string;
  active: boolean;
  lastUpdatedAtCQ: string;
};

export interface CQDirectoryEntryCreate extends BaseDomainCreate, CQDirectoryEntryData {}

export interface CQDirectoryEntry extends BaseDomain, CQDirectoryEntryCreate {}

// TODO  2553 Remove these
export type CQDirectoryEntryData2 = {
  id: string; // Organization's OID
  name?: string;
  urlXCPD?: string;
  urlDQ?: string;
  urlDR?: string;
  lat?: number;
  lon?: number;
  addressLine?: string;
  city?: string;
  state?: string;
  zip?: string;
  data?: FhirOrganization;
  point?: string;
  managingOrganization?: string;
  managingOrganizationId?: string;
  active: boolean;
  lastUpdatedAtCQ: string;
};

export interface CQDirectoryEntryCreate2 extends BaseDomainCreate, CQDirectoryEntryData2 {}

export interface CQDirectoryEntry2 extends BaseDomain, CQDirectoryEntryCreate2 {}
