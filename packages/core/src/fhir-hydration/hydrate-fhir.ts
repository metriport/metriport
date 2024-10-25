import { Bundle, Resource } from "@medplum/fhirtypes";
import { buildBundleEntry, extractFhirTypesFromBundle } from "../external/fhir/shared/bundle";
import { cloneDeep } from "lodash";
import { capture } from "../util";
import { hydrateObservations } from "./resources/observation";

export function hydrateFhir(
  fhirBundle: Bundle<Resource>,
  cxId: string,
  patientId: string
): Bundle<Resource> {
  const hydratedBundle: Bundle = cloneDeep(fhirBundle);
  const resourceArrays = extractFhirTypesFromBundle(hydratedBundle);

  const hydratedObservations = hydrateObservations(resourceArrays.observationVitals);
  resourceArrays.observationVitals = hydratedObservations;

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

  hydratedBundle.entry = Object.entries(resourceArrays).flatMap(([, resources]) => {
    const entriesArray = Array.isArray(resources) ? resources : [resources];
    return entriesArray.flatMap(v => v || []).map(entry => buildBundleEntry(entry as Resource));
  });
  hydratedBundle.total = hydratedBundle.entry.length;

  return hydratedBundle;
}
