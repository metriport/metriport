import { out } from "@metriport/core/util";

// TODO 2888: Implement this function
export async function processHl7FhirBundleWebhook({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
  presignedUrl: string;
}): Promise<void> {
  const { log } = out(`processHl7FhirBundleWebhook, cx: ${cxId}, pt: ${patientId}`);
  log(`Will process presignedUrl... [STUB]`);
}
