import { Bundle, Composition } from "@medplum/fhirtypes";
import { findResourceInBundle, isComposition } from "../external/fhir/shared";
import NotFoundError from "../util/error/not-found";

/**
 * Splits the incoming FHIR bundle into multiple bundles based on the compositions.
 * @param fhirBundle The incoming FHIR bundle.
 * @returns An array of FHIR bundles, each corresponding to a composition.
 */
export function splitBundleByCompositions(fhirBundle: Bundle): Bundle[] {
  const compositions: Composition[] =
    fhirBundle.entry?.flatMap(entry => (isComposition(entry.resource) ? [entry.resource] : [])) ||
    [];

  if (compositions.length === 0) {
    throw new NotFoundError("No compositions found in the bundle");
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
      throw new NotFoundError("Patient resource not found");
    }
    const organizationResource = organizationReference
      ? findResourceInBundle(fhirBundle, organizationReference)
      : undefined;
    if (!organizationResource) {
      throw new NotFoundError("Organization resource not found");
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
