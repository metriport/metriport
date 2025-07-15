import {
  APIMode,
  CertificatePurpose,
  CommonWell,
  CommonWellAPI,
  CommonWellMember,
  CommonWellMemberAPI,
} from "@metriport/commonwell-sdk";
import { MetriportError } from "@metriport/shared";
import { X509Certificate } from "crypto";
import dayjs from "dayjs";
import { Config } from "../../shared/config";

const apiMode = Config.isProdEnv() ? APIMode.production : APIMode.integration;

/**
 *
 * @param orgName Organization Name
 * @param orgOID Organization OID without 'urn:oid:' namespace
 * @returns CommonWell API
 */
export function makeCommonWellMemberAPI(orgName: string, orgOID: string): CommonWellMemberAPI {
  // TODO implement this
  // TODO implement this
  // TODO implement this
  // TODO implement this
  // if (Config.isSandbox()) {
  //   return new CommonWellMemberMock(orgName, orgOID);
  // }

  // const options: CommonWellOptions = {
  //   onError500: {
  //     retry: true,
  //     maxAttempts: 3,
  //     initialDelay: 1_000,
  //   },
  // };

  const isMemberAPI = orgOID === Config.getCWMemberOID();
  if (!isMemberAPI)
    throw new MetriportError("Not a member OID", undefined, {
      orgOID,
    });

  return new CommonWellMember({
    orgCert: Config.getCWMemberCertificate(),
    rsaPrivateKey: Config.getCWMemberPrivateKey(),
    memberName: orgName,
    memberId: orgOID,
    apiMode,
    // options,
  });
}

export function makeCommonWellAPI(orgName: string, orgOID: string, npi: string): CommonWellAPI {
  // TODO implement this
  // TODO implement this
  // TODO implement this
  // TODO implement this
  // if (Config.isSandbox()) {
  //   return new CommonWellMock(orgName, orgOID);
  // }

  // const options: CommonWellOptions = {
  //   onError500: {
  //     retry: true,
  //     maxAttempts: 3,
  //     initialDelay: 1_000,
  //   },
  // };

  const isMemberAPI = orgOID === Config.getCWMemberOID();
  if (isMemberAPI) throw new Error("Not a member API");

  return new CommonWell({
    orgCert: Config.getCWOrgCertificate(),
    rsaPrivateKey: Config.getCWOrgPrivateKey(),
    orgName,
    oid: orgOID,
    homeCommunityId: orgOID,
    npi,
    apiMode,
    // options,
  });
}

function getCertData() {
  const certificate = Config.getCWOrgCertificate();
  const x509 = new X509Certificate(certificate);
  const thumbprint = x509.fingerprint;
  const validFrom = dayjs(x509.validFrom).toString();
  const validTo = dayjs(x509.validTo).toString();
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
