import { BaseDomain, BaseDomainCreate } from "../base-domain";
import { Organization } from "@metriport/carequality-sdk/models/organization";

export interface CQDirectoryOrganizationCreate extends BaseDomainCreate {
  oid: string;
  name?: string;
  urlXCPD: string;
  urlDQ?: string;
  urlDR?: string;
  latitude?: string;
  longitude?: string;
  state?: string;
  data?: Organization;
}

export interface CQOrganization extends BaseDomain, CQDirectoryOrganizationCreate {}
