import { Bundle, Composition } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { findResourceInBundle, isComposition } from "../external/fhir/shared";
import { capture } from "../util";

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
    throw new BadRequestError("No compositions found in the bundle");
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
      const msg = `Invalid Patient reference in the subject field`;
      capture.error(msg, {
        extra: {
          patientReference,
          organizationReference,
          context:
            "splitBundleByCompositions - creating CDAs from FHIR bundles containing compositions",
        },
      });
      throw new BadRequestError("Invalid Patient reference in the subject field");
    }
    const organizationResource = organizationReference
      ? findResourceInBundle(fhirBundle, organizationReference)
      : undefined;
    if (!organizationResource) {
      throw new BadRequestError("Invalid Organization reference in the author field");
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
