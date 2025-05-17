import { MetriportError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";

export function parseExternalId(source: string, externalId: string): string {
  if (source === EhrSources.athena) {
    const ehrPatientId = externalId.split("-")[2];
    if (!ehrPatientId) {
      throw new MetriportError("AthenaHealth patient mapping externalId is malformed", undefined, {
        externalId,
      });
    }
    return ehrPatientId;
  }
  return externalId;
}
