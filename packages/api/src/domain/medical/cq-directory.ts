import { BaseDomain, BaseDomainCreate } from "../base-domain";
import { Organization } from "@metriport/carequality-sdk/models/organization";

export type CQDirectoryEntryData = {
  oid: string;
  name?: string;
  urlXCPD: string;
  urlDQ?: string;
  urlDR?: string;
  lat?: number;
  lon?: number;
  state?: string;
  data?: Organization;
  point?: string;
  lastUpdated: string;
};

export interface CQDirectoryEntryCreate extends BaseDomainCreate, CQDirectoryEntryData {}

export interface CQDirectoryEntry extends BaseDomain, CQDirectoryEntryCreate {}
