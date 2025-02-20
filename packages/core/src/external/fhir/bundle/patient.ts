import { Bundle, BundleEntry, Patient } from "@medplum/fhirtypes";
import { isPatient } from "../shared";

export function getPatientsFromBundle(bundle: Bundle): Patient[] {
  return (bundle.entry ?? [])
    .filter((entry: BundleEntry): entry is BundleEntry<Patient> => isPatient(entry.resource))
    .map(entry => entry.resource as Patient);
}
