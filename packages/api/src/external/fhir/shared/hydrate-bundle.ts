import { Extension, Organization, Patient } from "@medplum/fhirtypes";
import { isValidUuid } from "@metriport/shared";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { Bundle as ValidBundle } from "../../../routes/medical/schemas/fhir";

/**
 * Adds the Metriport and Document extensions to all the provided resources, ensures that all resources have UUIDs for IDs,
 * and adds the Patient and Organization resources to the Bundle
 */
export function hydrateBundle(
  bundle: ValidBundle,
  patient: Patient,
  org: Organization,
  fhirBundleDestinationKey: string
): ValidBundle {
  const docExtension: Extension = {
    url: "https://public.metriport.com/fhir/StructureDefinition/doc-id-extension.json",
    valueString: fhirBundleDestinationKey,
  };

  const bundleWithExtensions = validateUuidsAndAddExtensions(bundle, docExtension);
  bundleWithExtensions.entry?.push({ resource: patient });
  bundleWithExtensions.entry?.push({ resource: org });

  return bundleWithExtensions;
}

type ReplacementIdPair = { old: string; new: string };

function validateUuidsAndAddExtensions(bundle: ValidBundle, docExtension: Extension): ValidBundle {
  const replacements: ReplacementIdPair[] = [];
  bundle.entry.forEach(entry => {
    const oldId = entry.resource.id;
    if (!isValidUuid(oldId)) {
      replacements.push({
        old: oldId,
        new: uuidv7(),
      });
    }
    if (entry.resource.extension) {
      entry.resource.extension.push(metriportDataSourceExtension);
      entry.resource.extension.push(docExtension);
    } else {
      entry.resource.extension = [metriportDataSourceExtension, docExtension];
    }
  });
  let bundleString = JSON.stringify(bundle);
  replacements.forEach((idPair: ReplacementIdPair) => {
    bundleString = bundleString.replaceAll(idPair.old, idPair.new);
  });
  return JSON.parse(bundleString);
}
