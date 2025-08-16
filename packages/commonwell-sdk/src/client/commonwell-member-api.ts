import { CertificateParam, CertificateResp } from "../models/certificates";
import { Organization, OrganizationList } from "../models/organization";
import { BaseRequestMetadata } from "./common";

export type BaseOptions = {
  meta?: MemberRequestMetadata;
};

export type MemberRequestMetadata = BaseRequestMetadata;

export interface CommonWellMemberAPI {
  get lastTransactionId(): string | undefined;
  createOrg(organization: Organization, options?: BaseOptions): Promise<Organization>;
  updateOrg(organization: Organization, options?: BaseOptions): Promise<Organization>;
  getAllOrgs(
    summary?: boolean,
    offset?: number,
    limit?: number,
    sort?: string,
    options?: BaseOptions
  ): Promise<OrganizationList>;
  getOneOrg(id: string, options?: BaseOptions): Promise<Organization | undefined>;
  addCertificateToOrg(
    certificate: CertificateParam,
    id: string,
    options?: BaseOptions
  ): Promise<CertificateResp>;
  replaceCertificateForOrg(
    certificate: CertificateParam,
    id: string,
    options?: BaseOptions
  ): Promise<CertificateResp>;
  deleteCertificateFromOrg(
    id: string,
    thumbprint: string,
    purpose: string,
    options?: BaseOptions
  ): Promise<string>;
  getCertificatesFromOrg(
    id: string,
    thumbprint?: string,
    purpose?: string,
    options?: BaseOptions
  ): Promise<CertificateResp>;
  getCertificatesFromOrgByThumbprint(
    id: string,
    thumbprint: string,
    purpose?: string,
    options?: BaseOptions
  ): Promise<CertificateResp>;
  getCertificatesFromOrgByThumbprintAndPurpose(
    id: string,
    thumbprint: string,
    purpose: string,
    options?: BaseOptions
  ): Promise<CertificateResp>;
}
