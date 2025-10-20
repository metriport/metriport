import { ACM, CertificateSummary, CertificateType } from "@aws-sdk/client-acm";

export class AcmUtils {
  public readonly _acmClient: ACM;

  constructor(readonly region: string) {
    this._acmClient = new ACM({ region });
  }

  /**
   * List all certificates in the account.
   * @param type - Optional filter to only include certificates of a specific type.
   * @returns A list of certificate summaries.
   */
  async listCertificates({ type }: { type?: CertificateType } = {}): Promise<CertificateSummary[]> {
    const allCerts: CertificateSummary[] = [];
    let continuationToken: string | undefined;
    do {
      const res = await this._acmClient.listCertificates(
        continuationToken ? { NextToken: continuationToken } : {}
      );
      if (res.CertificateSummaryList) {
        allCerts.push(...res.CertificateSummaryList);
      }
      continuationToken = res.NextToken;
    } while (continuationToken);

    const importedCerts = type ? allCerts.filter(cert => cert.Type === type) : allCerts;
    return importedCerts;
  }
}
