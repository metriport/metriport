/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  CertificateParam,
  CertificateResp,
  CommonWellMemberAPI,
  Organization,
  OrganizationList,
} from "@metriport/commonwell-sdk";
import { BaseOptions } from "@metriport/commonwell-sdk/client/commonwell-api";

export class CommonWellMemberMock implements CommonWellMemberAPI {
  private _oid: string;

  constructor(oid: string) {
    this._oid = oid;
  }

  get oid() {
    return this._oid;
  }
  get lastTransactionId() {
    return undefined;
  }

  async createOrg(organization: Organization, options?: BaseOptions): Promise<Organization> {
    return organization;
  }
  async updateOrg(organization: Organization, options?: BaseOptions): Promise<Organization> {
    return organization;
  }

  async getAllOrgs(
    summary?: boolean,
    offset?: number,
    limit?: number,
    sort?: string,
    options?: BaseOptions
  ): Promise<OrganizationList> {
    return {
      count: 0,
      from: 0,
      to: 0,
      organizations: [],
    };
  }

  async getOneOrg(id: string, options?: BaseOptions): Promise<Organization | undefined> {
    return undefined;
  }

  async addCertificateToOrg(
    certificate: CertificateParam,
    id: string,
    options?: BaseOptions
  ): Promise<CertificateResp> {
    return {
      certificates: [],
    };
  }

  async replaceCertificateForOrg(
    certificate: CertificateParam,
    id: string,
    options?: BaseOptions
  ): Promise<CertificateResp> {
    return {
      certificates: [],
    };
  }

  async deleteCertificateFromOrg(
    id: string,
    thumbprint: string,
    purpose: string,
    options?: BaseOptions
  ): Promise<string> {
    return "Success";
  }

  async getCertificatesFromOrg(
    id: string,
    thumbprint?: string,
    purpose?: string,
    options?: BaseOptions
  ): Promise<CertificateResp> {
    return {
      certificates: [],
    };
  }

  async getCertificatesFromOrgByThumbprint(
    id: string,
    thumbprint: string,
    purpose?: string,
    options?: BaseOptions
  ): Promise<CertificateResp> {
    return {
      certificates: [],
    };
  }

  async getCertificatesFromOrgByThumbprintAndPurpose(
    id: string,
    thumbprint: string,
    purpose: string,
    options?: BaseOptions
  ): Promise<CertificateResp> {
    return {
      certificates: [],
    };
  }
}
