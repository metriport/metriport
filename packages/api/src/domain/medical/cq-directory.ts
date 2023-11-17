import { BaseDomain, BaseDomainCreate } from "../base-domain";

export interface CQDirectoryOrganizationCreate extends BaseDomainCreate {
  oid: string;
  name?: string;
  urlXCPD: string;
  urlDQ?: string;
  urlDR?: string;
  latitude?: string;
  longitude?: string;
  state?: string;
  data: string;
}

export interface CQOrganization extends BaseDomain, CQDirectoryOrganizationCreate {}
