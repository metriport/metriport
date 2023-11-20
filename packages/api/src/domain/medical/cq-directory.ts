import { BaseDomain, BaseDomainCreate } from "../base-domain";
import { Organization } from "@metriport/carequality-sdk/models/organization";

export type CQDirectoryOrganizationData = {
  oid: string;
  name?: string;
  urlXCPD: string;
  urlDQ?: string;
  urlDR?: string;
  lat?: string;
  lon?: string;
  state?: string;
  data?: Organization;
};

export interface CQDirectoryOrganizationCreate
  extends BaseDomainCreate,
    CQDirectoryOrganizationData {}

export interface CQOrganization extends BaseDomain, CQDirectoryOrganizationCreate {}
