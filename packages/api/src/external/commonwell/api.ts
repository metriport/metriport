import {
  APIMode,
  baseQueryMeta,
  CertificatePurpose,
  CommonWell,
  CommonWellAPI,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { CookieManagerOnSecrets } from "@metriport/core/domain/auth/cookie-management/cookie-manager-on-secrets";
import { CommonWellManagementAPI } from "@metriport/core/external/commonwell/management/api";
import { makeApi } from "@metriport/core/external/commonwell/management/api-factory";
import { X509Certificate } from "crypto";
import dayjs from "dayjs";
import { Config } from "../../shared/config";
import { CommonWellMock } from "./mock";

const apiMode = Config.isProdEnv() ? APIMode.production : APIMode.integration;

/**
 * Returns a new instance of the CommonWellManagementAPI, which is to be used exclusively
 * to perform operations done through the management portal.
 * For most cases we want to call makeCommonWellAPI() instead.
 */
export function makeCommonWellManagementAPI(): CommonWellManagementAPI | undefined {
  const cookieArn = Config.getCWManagementCookieArn();
  if (!cookieArn) return undefined;

  const cwManagementBaseUrl = Config.getCWManagementUrl();
  if (!cwManagementBaseUrl) return undefined;

  const cookieManager = new CookieManagerOnSecrets(cookieArn, Config.getAWSRegion());

  return makeApi({ cookieManager, baseUrl: cwManagementBaseUrl });
}

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
