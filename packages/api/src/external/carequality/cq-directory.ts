import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { Organization } from "@metriport/carequality-sdk/models/organization";

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
  data?: Organization;
  point?: string;
  managingOrganization?: string;
  managingOrganizationId?: string;
  active: boolean;
  lastUpdatedAtCQ: string;
};

export interface CQDirectoryEntryCreate extends BaseDomainCreate, CQDirectoryEntryData {}

export interface CQDirectoryEntry extends BaseDomain, CQDirectoryEntryCreate {}
