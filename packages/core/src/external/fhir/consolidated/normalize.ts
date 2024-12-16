import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { out } from "../../../util";
import { normalizeFhir } from "../normalization/normalize-fhir";

export function normalize({
  cxId,
  patientId,
  bundle,
}: {
  cxId?: string;
  patientId: string;
  bundle: Bundle<Resource>;
}): Bundle<Resource> {
  const { log } = out(`Normalizing FHIR for cxId ${cxId}, patientId ${patientId}`);
  const startedAt = new Date();
  const normalizedBundle = normalizeFhir(bundle);

  log(`Finished normalization in ${elapsedTimeFromNow(startedAt)} ms...`);
  return normalizedBundle;
}
