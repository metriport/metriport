import { Bundle } from "@medplum/fhirtypes";
import { makeFhirApi } from "../api/api-factory";

export enum ResourceType {
  Organization = "Organization",
  Patient = "Patient",
  DocumentReference = "DocumentReference",
}

export const MAX_FHIR_DOC_ID_LENGTH = 64;

export async function postFHIRBundle(cxId: string, bundle: Bundle) {
  const fhir = makeFhirApi(cxId);
  try {
    await fhir.executeBatch(bundle);
  } catch (err) {
    console.log(`[postFHIRBundle] ` + JSON.stringify(err));
    throw err;
  }
}
