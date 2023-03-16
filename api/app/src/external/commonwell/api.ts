import {
  APIMode,
  CommonWell,
  CommonWellAPI,
  PurposeOfUse,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { CertificatePurpose } from "@metriport/commonwell-sdk/lib/models/certificates";
import { X509Certificate } from "crypto";
import { Config } from "../../shared/config";
import { CommonWellMock } from "./mock";

const apiMode = Config.isProdEnv() ? APIMode.production : APIMode.integration;

/**
 *
 * @param orgName Organization Name
 * @param orgId Organization ID without 'urn:oid:' namespace
 * @returns CommonWell API
 */
export function makeCommonWellAPI(orgName: string, orgId: string): CommonWellAPI {
  if (Config.isSandbox()) {
    return new CommonWellMock(orgName, orgId);
  }

  const isMember = orgId === Config.getMemberManagementOID();

  if (isMember) {
    return new CommonWell(
      Config.getMemberManagementCert(),
      Config.getMemberManagementPrivateKey(),
      orgName,
      orgId,
      apiMode
    );
  }

  return new CommonWell(
    Config.getMetriportCert(),
    Config.getMetriportPrivateKey(),
    orgName,
    orgId,
    apiMode
  );
}

const baseQueryMeta = (orgName: string) => ({
  purposeOfUse: PurposeOfUse.TREATMENT,
  role: "ict",
  subjectId: `${orgName} System User`,
});

export type OrgRequestMetadataCreate = Omit<
  RequestMetadata,
  "npi" | "role" | "purposeOfUse" | "subjectId"
> &
  Required<Pick<RequestMetadata, "npi">> &
  Partial<Pick<RequestMetadata, "role" | "purposeOfUse">>;

export function organizationQueryMeta(
  orgName: string,
  meta: OrgRequestMetadataCreate
): RequestMetadata {
  const base = baseQueryMeta(orgName);
  return {
    subjectId: base.subjectId,
    role: meta.role ?? base.role,
    purposeOfUse: meta.purposeOfUse ?? base.purposeOfUse,
    npi: meta.npi,
  };
}

export const metriportQueryMeta: RequestMetadata = baseQueryMeta("Metriport");

// CERTIFICATE

const commonwellCertificate = Config.getMetriportCert();
const commonwellCertificateContent = getCertificateContent(commonwellCertificate);
const x509 = new X509Certificate(commonwellCertificate);

const thumbprint = x509.fingerprint;

// TODO #219 #413 gotta make these dynamic
export const certificate = {
  Certificates: [
    {
      startDate: "2022-12-31T11:46:29Z",
      endDate: "2023-03-31T12:46:28Z",
      expirationDate: "2023-03-31T12:46:28Z",
      thumbprint: thumbprint,
      content: commonwellCertificateContent,
      purpose: CertificatePurpose.Authentication,
    },
    {
      startDate: "2022-12-31T11:46:29Z",
      endDate: "2023-03-31T12:46:28Z",
      expirationDate: "2023-03-31T12:46:28Z",
      thumbprint: thumbprint,
      content: commonwellCertificateContent,
      purpose: CertificatePurpose.Signing,
    },
  ],
};

function getCertificateContent(cert: string): string | undefined {
  const regex = /-+BEGIN CERTIFICATE-+([\s\S]+?)-+END CERTIFICATE-+/i;
  const matches = cert.match(regex);
  if (matches && matches.length > 1) {
    const content = matches[1];
    return content.replace(/\r\n|\n|\r/gm, "");
  }
  return undefined;
}
