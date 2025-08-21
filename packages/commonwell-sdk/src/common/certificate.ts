import { Certificate } from "../models/certificates";

export function normalizeCertificate(certificate: Certificate): Certificate {
  return {
    ...certificate,
    ...(certificate.thumbprint && { thumbprint: certificate.thumbprint.replace(/:/g, "") }),
  };
}
