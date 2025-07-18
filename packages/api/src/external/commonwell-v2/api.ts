import {
  APIMode,
  CertificatePurpose,
  CommonWell,
  CommonWellAPI,
  CommonWellMember,
  CommonWellMemberAPI,
} from "@metriport/commonwell-sdk";
import { MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { X509Certificate } from "crypto";
import { Config } from "../../shared/config";
import { CommonWellMock } from "./mock/api-mock";
import { CommonWellMemberMock } from "./mock/member-mock";

const apiMode = Config.isProdEnv() ? APIMode.production : APIMode.integration;

/**
 * Make an instance of the CommonWell Member API to interact with the CommonWell
 * acting as a Member. Used to manage Organizations.
 *
 * @param orgName Organization Name
 * @param memberId ID of the CommonWell member (not the OID)
 * @returns CommonWell API
 */
export function makeCommonWellMemberAPI(): CommonWellMemberAPI {
  const memberName = Config.getCWMemberOrgName();
  const memberId = Config.getCWMemberID();

  if (Config.isSandbox()) {
    return new CommonWellMemberMock(memberId);
  }

  return new CommonWellMember({
    orgCert: Config.getCWMemberCertificate(),
    rsaPrivateKey: Config.getCWMemberPrivateKey(),
    memberName: memberName,
    memberId: memberId,
    apiMode,
  });
}

/**
 * Make an instance of the CommonWell API to interact with the CommonWell
 * acting as an Organization. Used to manage Patients and Documents.
 *
 * @param orgName Organization Name
 * @param orgOID Organization OID without 'urn:oid:' namespace
 * @param npi Organization NPI
 * @returns CommonWell API
 */
export function makeCommonWellAPI(orgName: string, orgOID: string, npi: string): CommonWellAPI {
  if (Config.isSandbox()) {
    return new CommonWellMock(orgName, orgOID);
  }

  const isMemberAPI = [Config.getCWMemberOID(), Config.getSystemRootOID()].includes(orgOID);
  if (isMemberAPI) {
    throw new MetriportError("Cannot use the member/root OID as an organization OID", undefined, {
      orgOID,
    });
  }

  return new CommonWell({
    orgCert: Config.getCWOrgCertificate(),
    rsaPrivateKey: Config.getCWOrgPrivateKey(),
    orgName,
    oid: orgOID,
    homeCommunityId: orgOID,
    npi,
    apiMode,
  });
}

function getCertData() {
  const certificate = Config.getCWOrgCertificate();
  const x509 = new X509Certificate(certificate);
  const thumbprint = x509.fingerprint;
  const validFrom = buildDayjs(x509.validFrom).toString();
  const validTo = buildDayjs(x509.validTo).toString();
  return { certificate, validFrom, validTo, thumbprint };
}

export function getCertificate() {
  const { certificate, validFrom, validTo, thumbprint } = getCertData();
  const commonwellCertificateContent = getCertificateContent(certificate);
  return {
    Certificates: [
      {
        startDate: validFrom,
        endDate: validTo,
        expirationDate: validTo,
        thumbprint: thumbprint,
        content: commonwellCertificateContent,
        purpose: CertificatePurpose.Authentication,
      },
      {
        startDate: validFrom,
        endDate: validTo,
        expirationDate: validTo,
        thumbprint: thumbprint,
        content: commonwellCertificateContent,
        purpose: CertificatePurpose.Signing,
      },
    ],
  };
}

function getCertificateContent(cert: string): string | undefined {
  const regex = /-+BEGIN CERTIFICATE-+([\s\S]+?)-+END CERTIFICATE-+/i;
  const matches = cert.match(regex);
  if (matches && matches[1]) {
    const content = matches[1];
    return content.replace(/\r\n|\n|\r/gm, "");
  }
  return undefined;
}
