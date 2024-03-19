import { Bundle, Composition } from "@medplum/fhirtypes";
import { isComposition, findResourceInBundle } from "./fhir";
import { MetriportError } from "../util/error/metriport-error";

/**
 * Splits the incoming FHIR bundle into multiple bundles based on the compositions.
 * @param fhirBundle The incoming FHIR bundle.
 * @returns An array of FHIR bundles, each corresponding to a composition.
 */
export function splitBundleByCompositions(fhirBundle: Bundle): Bundle[] {
  const compositions: Composition[] | undefined = fhirBundle.entry
    ?.filter(entry => isComposition(entry.resource))
    .map(entry => entry.resource as Composition);

  if (!compositions) {
    return [];
  }

  const bundles: Bundle[] = compositions.map(composition => {
    const patientReference = composition.subject?.reference;
    const organizationReference = composition.author?.find(author =>
      author.reference?.startsWith("Organization/")
    )?.reference;

    const patientResource = patientReference
      ? findResourceInBundle(fhirBundle, patientReference)
      : undefined;
    if (!patientResource) {
      throw new MetriportError("Patient resource not found", fhirBundle);
    }
    const organizationResource = organizationReference
      ? findResourceInBundle(fhirBundle, organizationReference)
      : undefined;
    if (!organizationResource) {
      throw new MetriportError("Organization resource not found", fhirBundle);
    }

    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "document",
      entry: [
        {
          fullUrl: `urn:uuid:${composition.id}`,
          resource: composition,
        },
        {
          fullUrl: `urn:uuid:${patientResource.id}`,
          resource: patientResource,
        },
        {
          fullUrl: `urn:uuid:${organizationResource.id}`,
          resource: organizationResource,
        },
      ],
    };

    composition.section?.forEach(section => {
      section.entry?.forEach(entry => {
        if (entry.reference) {
          const referencedResource = findResourceInBundle(fhirBundle, entry.reference);
          if (referencedResource) {
            if (bundle.entry) {
              bundle.entry.push({
                fullUrl: entry.reference,
                resource: referencedResource,
              });
            }
          }
        }
      });
    });

    return bundle;
  });

  return bundles;
}
