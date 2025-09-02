import { BadRequestError, MetriportError, NotFoundError } from "@metriport/shared";
import { isAxiosError } from "axios";
import httpStatus from "http-status";
import { normalizeCertificate } from "../common/certificate";
import { makeJwt } from "../common/make-jwt";
import { buildBaseQueryMeta } from "../common/util";
import { CertificateParam, CertificateResp, certificateRespSchema } from "../models/certificates";
import {
  Organization,
  OrganizationList,
  organizationListSchema,
  organizationSchema,
} from "../models/organization";
import { APIMode, CommonWellOptions } from "./common";
import { CommonWellBase } from "./commonwell-base";
import { BaseOptions, CommonWellMemberAPI, MemberRequestMetadata } from "./commonwell-member-api";

/**
 * Implementation of the CommonWell API, v4.
 * @see https://www.commonwellalliance.org/specification/
 *
 * For the Organization management API (member API):
 * @see https://commonwellalliance.sharepoint.com/sites/CommonWellServicesPlatform/SitePages/Organization-APIs.aspx
 */
export class CommonWellMember extends CommonWellBase implements CommonWellMemberAPI {
  static ORG_ENDPOINT = "/v1/org";
  static MEMBER_ENDPOINT = "/v1/member";

  private memberName: string;
  private _memberId: string;

  /**
   * Creates a new instance of the CommonWell API client pertaining to an
   * organization to make requests on behalf of.
   *
   * @param orgCert         The certificate (public key) for the organization.
   * @param rsaPrivateKey   An RSA key corresponding to the specified orgCert.
   * @param memberName      The name of the member.
   * @param memberId        The ID of the member (not the OID).
   * @param apiMode         The mode the client will be running.
   * @param options         Optional parameters
   * @param options.timeout Connection timeout in milliseconds, default 120 seconds.
   */
  constructor({
    orgCert,
    rsaPrivateKey,
    memberName,
    memberId,
    apiMode,
    options = {},
  }: {
    orgCert: string;
    rsaPrivateKey: string;
    memberName: string;
    memberId: string;
    apiMode: APIMode;
    options?: CommonWellOptions;
  }) {
    super({
      orgCert,
      rsaPrivateKey,
      apiMode,
      options,
    });
    this.memberName = memberName;
    this._memberId = memberId;
  }

  get memberId() {
    return this._memberId;
  }

  // TODO: #322 handle errors in API calls as per
  // https://specification.commonwellalliance.org/services/rest-api-reference (8.6.1 Error)
  // Note that also sometimes these calls 404 when things aren't found and etc

  /**
   * Create an org.
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#post-a-new-organization
   *
   * @param organization The org to create.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns
   */
  async createOrg(organization: Organization, options?: BaseOptions): Promise<Organization> {
    const meta = options?.meta ?? buildBaseQueryMeta(this.memberName);
    const headers = this.buildQueryHeaders(meta);
    try {
      const resp = await this.api.post(
        `${CommonWellMember.MEMBER_ENDPOINT}/${this.memberId}/org`,
        organization,
        {
          headers,
        }
      );
      return organizationSchema.parse(resp.data);
    } catch (error) {
      throw this.getDescriptiveError(error, "Failed to create CW organization");
    }
  }

  /**
   * Update an organization.
   *
   * @param organization The org to update.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns
   */
  async updateOrg(organization: Organization, options?: BaseOptions): Promise<Organization> {
    const meta = options?.meta ?? buildBaseQueryMeta(this.memberName);
    const headers = this.buildQueryHeaders(meta);
    const id = organization.organizationId;
    try {
      const resp = await this.api.put(
        `${CommonWellMember.MEMBER_ENDPOINT}/${this.memberId}/org/${id}/`,
        organization,
        {
          headers,
        }
      );
      return organizationSchema.parse(resp.data);
    } catch (error) {
      throw this.getDescriptiveError(error, "Failed to update CW organization");
    }
  }

  /**
   * Get list of orgs.
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#get-a-list-of-all-organizations
   *
   * @param summary Returns only summary data
   * @param offset Sets an offset number from which recorded returns will begin
   * @param limit  Limits the number of returned records
   * @param sort   Specifies sort order
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns
   */
  async getAllOrgs(
    summary?: boolean,
    offset?: number,
    limit?: number,
    sort?: string,
    options?: BaseOptions
  ): Promise<OrganizationList> {
    const meta = options?.meta ?? buildBaseQueryMeta(this.memberName);
    const headers = this.buildQueryHeaders(meta);

    try {
      const resp = await this.api.get(`${CommonWellMember.MEMBER_ENDPOINT}/${this.memberId}/org`, {
        headers,
        params: { summary, offset, limit, sort },
      });
      return organizationListSchema.parse(resp.data);
    } catch (error) {
      throw this.getDescriptiveError(error, "Failed to get CW organization list");
    }
  }

  /**
   * Get one org.
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#get-a-single-organization
   *
   * @param id The ID of the organization to be returned.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns
   */
  async getOneOrg(id: string, options?: BaseOptions): Promise<Organization | undefined> {
    const meta = options?.meta ?? buildBaseQueryMeta(this.memberName);
    const headers = this.buildQueryHeaders(meta);

    const resp = await this.api.get(
      `${CommonWellMember.MEMBER_ENDPOINT}/${this.memberId}/org/${id}/`,
      {
        headers,
        validateStatus: null, // don't throw on status code > 299
      }
    );
    const status = resp.status;
    if (status === httpStatus.NOT_FOUND) return undefined;
    if (httpStatus[`${status}_CLASS`] === httpStatus.classes.SUCCESSFUL) {
      return organizationSchema.parse(resp.data);
    }
    // TODO ENG-668 Revert to throwing error on non-404 unsuccessful status codes
    return undefined;
    // throw new MetriportError(`Failed to retrieve Organization`, status);
  }

  /**
   * Add certificate to org.
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#post-new-certificates-to-organizations
   *
   * @param certificate The certificate to add to the org
   * @param id The org to add a certificate to.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns
   */
  async addCertificateToOrg(
    certificate: CertificateParam,
    id: string,
    options?: BaseOptions
  ): Promise<CertificateResp> {
    const meta = options?.meta ?? buildBaseQueryMeta(this.memberName);
    const headers = this.buildQueryHeaders(meta);
    const normalizedCertificates = certificate.Certificates.map(normalizeCertificate);
    const payload = {
      ...certificate,
      Certificates: normalizedCertificates,
    };
    const resp = await this.api.post(
      `${CommonWellMember.MEMBER_ENDPOINT}/${this.memberId}/org/${id}/certificate`,
      payload,
      {
        headers,
      }
    );
    return certificateRespSchema.parse(resp.data);
  }

  /**
   * Replace certificate for org.
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#put-a-list-of-certificates-into-an-organization
   *
   * @param certificate The certificate to replace for the org
   * @param id The org to replace a certificate for.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns
   */
  async replaceCertificateForOrg(
    certificate: CertificateParam,
    id: string,
    options?: BaseOptions
  ): Promise<CertificateResp> {
    const meta = options?.meta ?? buildBaseQueryMeta(this.memberName);
    const headers = this.buildQueryHeaders(meta);
    const normalizedCertificates = certificate.Certificates.map(normalizeCertificate);
    const payload = {
      ...certificate,
      Certificates: normalizedCertificates,
    };
    const resp = await this.api.put(
      `${CommonWellMember.MEMBER_ENDPOINT}/${this.memberId}/org/${id}/certificate`,
      payload,
      {
        headers,
      }
    );
    return certificateRespSchema.parse(resp.data);
  }

  /**
   * Delete certificate from org.
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#delete-certificates-by-thumbprint
   *
   * @param id The org to delete a certificate from.
   * @param thumbprint The thumbprint from the certificate.
   * @param purpose The purpose from the certificate.
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns a string with the message resulting from the deletion
   */
  async deleteCertificateFromOrg(
    id: string,
    thumbprint: string,
    purpose: string,
    options?: BaseOptions
  ): Promise<string> {
    const meta = options?.meta ?? buildBaseQueryMeta(this.memberName);
    const headers = this.buildQueryHeaders(meta);
    const resp = await this.api.delete(
      `${CommonWellMember.MEMBER_ENDPOINT}/${this.memberId}/org/${id}/certificate/${thumbprint}/purpose/${purpose}`,
      {
        headers,
      }
    );
    return resp.data;
  }

  /**
   * Get certificate from org.
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#get-certificates-for-an-organization
   *
   * @param id The org to get a certificate from
   * @param thumbprint The thumbprint from the certificate
   * @param purpose The purpose from the certificate
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns
   */
  async getCertificatesFromOrg(
    id: string,
    thumbprint?: string,
    purpose?: string,
    options?: BaseOptions
  ): Promise<CertificateResp> {
    const meta = options?.meta ?? buildBaseQueryMeta(this.memberName);
    const headers = this.buildQueryHeaders(meta);
    const resp = await this.api.get(
      `${CommonWellMember.MEMBER_ENDPOINT}/${this.memberId}/org/${id}/certificate`,
      {
        headers,
        params: { thumbprint, purpose },
      }
    );
    return certificateRespSchema.parse(resp.data);
  }

  /**
   * Get certificate from org (by thumbprint).
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#get-certificates-by-thumbprint
   *
   * @param id The org to get a certificate from
   * @param thumbprint The thumbprint from the certificate
   * @param purpose The purpose from the certificate
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns
   */
  async getCertificatesFromOrgByThumbprint(
    id: string,
    thumbprint: string,
    purpose?: string,
    options?: BaseOptions
  ): Promise<CertificateResp> {
    const meta = options?.meta ?? buildBaseQueryMeta(this.memberName);
    const headers = this.buildQueryHeaders(meta);
    const resp = await this.api.get(
      `${CommonWellMember.MEMBER_ENDPOINT}/${this.memberId}/org/${id}/certificate/${thumbprint}`,
      {
        headers,
        params: { purpose },
      }
    );
    return certificateRespSchema.parse(resp.data);
  }

  /**
   * Get certificate from org (by thumbprint & purpose).
   * See: https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#get-certificates-by-thumbprint-and-purpose
   *
   * @param id The org to get a certificate from
   * @param thumbprint The thumbprint from the certificate
   * @param purpose The purpose from the certificate
   * @param options Optional parameters.
   * @param options.meta Metadata about the request. Defaults to the data used to initialize the client.
   * @returns
   */
  async getCertificatesFromOrgByThumbprintAndPurpose(
    id: string,
    thumbprint: string,
    purpose: string,
    options?: BaseOptions
  ): Promise<CertificateResp> {
    const meta = options?.meta ?? buildBaseQueryMeta(this.memberName);
    const headers = this.buildQueryHeaders(meta);
    const resp = await this.api.get(
      `${CommonWellMember.MEMBER_ENDPOINT}/${this.memberId}/org/${id}/certificate/${thumbprint}/purpose/${purpose}`,
      {
        headers,
      }
    );
    return certificateRespSchema.parse(resp.data);
  }

  private buildQueryHeaders(meta: MemberRequestMetadata): Record<string, string> {
    const jwt = makeJwt({
      rsaPrivateKey: this.rsaPrivateKey,
      role: meta.role,
      subjectId: meta.subjectId,
      orgName: this.memberName,
      oid: this.memberId,
      purposeOfUse: meta.purposeOfUse,
    });
    return { Authorization: `Bearer ${jwt}` };
  }

  private getDescriptiveError(error: unknown, title: string): Error {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      const responseBody = data ? JSON.stringify(data) : undefined;
      const cwReference = this.lastTransactionId;

      if (status === httpStatus.BAD_REQUEST) {
        return new BadRequestError(title, error, { status, cwReference, responseBody });
      }
      if (status === httpStatus.NOT_FOUND) {
        return new NotFoundError(title, error, { status, cwReference, responseBody });
      }
      return new MetriportError(title, error, { status, cwReference, responseBody });
    }
    return error instanceof Error ? error : new MetriportError(title, error);
  }
}
