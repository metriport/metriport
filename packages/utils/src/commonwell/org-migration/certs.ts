import * as dotenv from "dotenv";
dotenv.config({ path: ".env._cw_org_migration" });
// keep that ^ on top
import { CertificatePurpose } from "@metriport/commonwell-sdk";
import { buildDayjs } from "@metriport/shared/common/date";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { X509Certificate } from "crypto";

function getCertData() {
  const certificate = getEnvVarOrFail("CW_ORG_CERTIFICATE");
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
