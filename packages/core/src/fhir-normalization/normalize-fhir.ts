import { Bundle, Resource } from "@medplum/fhirtypes";
import { buildBundleEntry, extractFhirTypesFromBundle } from "../external/fhir/shared/bundle";
import { cloneDeep } from "lodash";
import { capture } from "../util";
import { normalizeObservations } from "./resources/observation";

export function normalizeFhir(
  fhirBundle: Bundle<Resource>,
  cxId: string,
  patientId: string
): Bundle<Resource> {
  const normalizedBundle: Bundle = cloneDeep(fhirBundle);
  const resourceArrays = extractFhirTypesFromBundle(normalizedBundle);

  const normalizedObservations = normalizeObservations(resourceArrays.observationVitals);
  resourceArrays.observationVitals = normalizedObservations;

  if (!resourceArrays.patient) {
    capture.message("Critical Missing Patient in Hydrate FHIR", {
      extra: {
        cxId,
        patientId,
        patient: resourceArrays.patient,
      },
      level: "error",
    });
  }

  normalizedBundle.entry = Object.entries(resourceArrays).flatMap(([, resources]) => {
    const entriesArray = Array.isArray(resources) ? resources : [resources];
    return entriesArray.flatMap(v => v || []).map(entry => buildBundleEntry(entry as Resource));
  });
  normalizedBundle.total = normalizedBundle.entry.length;

  return normalizedBundle;
}
