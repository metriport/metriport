import { Bundle, Patient, Resource } from "@medplum/fhirtypes";
import { buildBundleEntry } from "../bundle/bundle";
import { getPatientFromBundle } from "../patient/shared";

/**
 * Ensures the bundle contains a Patient resource. If missing (e.g. CDA without recordTarget),
 * prepends a minimal Patient with the given id and returns a new bundle plus a flag.
 * Does not mutate the input bundle.
 */
export function ensurePatientInBundle(
  bundle: Bundle<Resource>,
  patientId: string
): { bundle: Bundle<Resource>; patientWasInjected: boolean } {
  const existingPatient = getPatientFromBundle(bundle, false);
  if (existingPatient) {
    return { bundle, patientWasInjected: false };
  }

  const minimalPatient: Patient = {
    resourceType: "Patient",
    id: patientId,
  };
  const patientEntry = buildBundleEntry(minimalPatient);
  const newBundle: Bundle<Resource> = {
    ...bundle,
    entry: [patientEntry, ...(bundle.entry ?? [])],
  };
  return { bundle: newBundle, patientWasInjected: true };
}
