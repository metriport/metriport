import { Organization as FhirOrganization } from "@medplum/fhirtypes";
import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";

export type EhexDirectoryEntryData = {
  id: string; // Organization's OID
  name?: string;
  urlXcpd?: string;
  urlDq?: string;
  urlDr?: string;
  // urlXdr?: string;
  lat?: number;
  lon?: number;
  addressLine?: string;
  city?: string;
  state?: string;
  zip?: string;
  data?: FhirOrganization;
  point?: string;
  rootOrganization?: string;
  managingOrganizationId?: string;
  active: boolean;
  lastUpdatedAtEhex: string;
  delegateOids?: string[];
};

export interface EhexDirectoryEntryCreate extends BaseDomainCreate, EhexDirectoryEntryData {}

export interface EhexDirectoryEntry extends BaseDomain, EhexDirectoryEntryCreate {}
