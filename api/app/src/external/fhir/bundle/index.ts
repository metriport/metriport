import { Bundle } from "@medplum/fhirtypes";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { makeFhirApi } from "../api/api-factory";

export const MAX_FHIR_DOC_ID_LENGTH = 64;

export async function postBundle(cxId: string, bundle: Bundle): Promise<void> {
  const { log } = Util.out(`fhir.postBundle - ${cxId}`);
  try {
    const fhir = makeFhirApi(cxId);
    const startTime = new Date().getTime();

    await fhir.executeBatch(bundle);

    const duration = new Date().getTime() - startTime;
    log(`Successfully posted bundle to FHIR server, took ${duration}ms`);
  } catch (error) {
    log(`Error posting bundle to FHIR server: ${error}`);
    capture.error(error, {
      extra: { context: `postFHIRBundle`, bundle },
    });
  }
}
