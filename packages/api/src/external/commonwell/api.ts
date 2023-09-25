import {
  APIMode,
  CertificatePurpose,
  CommonWell,
  CommonWellAPI,
  RequestMetadata,
  baseQueryMeta,
} from "@metriport/commonwell-sdk";
import { X509Certificate } from "crypto";
import dayjs from "dayjs";
import { Config } from "../../shared/config";
import { CommonWellMock } from "./mock";

const apiMode = Config.isProdEnv() ? APIMode.production : APIMode.integration;

/**
 *
 * @param orgName Organization Name
 * @param orgOID Organization OID without 'urn:oid:' namespace
 * @returns CommonWell API
 */
export function makeCommonWellAPI(orgName: string, orgOID: string): CommonWellAPI {
  if (Config.isSandbox()) {
    return new CommonWellMock(orgName, orgOID);
  }

  const isMemberAPI = orgOID === Config.getCWMemberOID();
  if (isMemberAPI) {
    return new CommonWell(
      Config.getCWMemberCertificate(),
      Config.getCWMemberPrivateKey(),
      orgName,
      orgOID,
      apiMode
    );
  }

  return new CommonWell(
    Config.getCWOrgCertificate(),
    Config.getCWOrgPrivateKey(),
    orgName,
    orgOID,
    apiMode
  );
}

export const metriportQueryMeta: RequestMetadata = baseQueryMeta("Metriport");

// CERTIFICATE

const commonwellCertificate = Config.getCWOrgCertificate();
const commonwellCertificateContent = getCertificateContent(commonwellCertificate);

export function getCertData() {
  const x509 = new X509Certificate(commonwellCertificate);
  const thumbprint = x509.fingerprint;
  const validFrom = dayjs(x509.validFrom).toString();
  const validTo = dayjs(x509.validTo).toString();
  return { validFrom, validTo, thumbprint };
}

export function getCertificate() {
  const { validFrom, validTo, thumbprint } = getCertData();
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
