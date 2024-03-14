import { Bundle, Composition, Resource } from "@medplum/fhirtypes";

/**
 * Splits the incoming FHIR bundle into multiple bundles based on the compositions.
 * @param {Bundle} fhirBundle The incoming FHIR bundle.
 * @returns {Bundle[]} An array of FHIR bundles, each corresponding to a composition.
 */
export function splitBundleByCompositions(fhirBundle: Bundle): Bundle[] {
  const compositions: Composition[] | undefined = fhirBundle.entry
    ?.filter(entry => entry.resource?.resourceType === "Composition")
    .map(entry => entry.resource as Composition);

  if (!compositions) {
    return [];
  }

  const bundles: Bundle[] = compositions.map(composition => {
    const patientReference = composition.subject?.reference;
    const organizationReference = composition.author?.find(author =>
      author.reference?.startsWith("Organization/")
    )?.reference;

    // Find the patient and organization resources in the bundle
    const patientResource = patientReference
      ? findResourceInBundle(fhirBundle, patientReference)
      : undefined;
    if (!patientResource) {
      throw new Error("Patient resource not found");
    }
    const organizationResource = organizationReference
      ? findResourceInBundle(fhirBundle, organizationReference)
      : undefined;
    if (!organizationResource) {
      throw new Error("Organization resource not found");
    }

    // Create a new bundle for the composition
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

    // Extract and add referenced resources to the bundle
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

/**
 * Finds a resource in the original bundle by its reference.
 * @param {Bundle} bundle The original FHIR bundle.
 * @param {string} reference The reference to the resource.
 * @returns {Resource | undefined} The found resource, or undefined if not found.
 */
function findResourceInBundle(bundle: Bundle, reference: string): Resource | undefined {
  if (!bundle.entry) {
    return undefined;
  }
  const entry = bundle.entry.find(entry => {
    const entryReference = `${entry.resource?.resourceType}/${entry.resource?.id}`;
    return entryReference === reference;
  });
  return entry?.resource;
}
