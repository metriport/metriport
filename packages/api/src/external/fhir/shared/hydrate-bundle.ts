import { Extension, Organization, Patient } from "@medplum/fhirtypes";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { isValidUuid, uuidv7 } from "@metriport/core/util/uuid-v7";
import { Bundle as ValidBundle } from "../../../routes/medical/schemas/fhir";
import { DOC_ID_EXTENSION_URL } from "./extensions/extension";

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
    url: DOC_ID_EXTENSION_URL,
    valueString: fhirBundleDestinationKey,
  };

  const bundleWithExtensions = validateUuidsAndAddExtensions(bundle, docExtension);
  const patientWithExtension = addUniqueExtension(patient, metriportDataSourceExtension);
  const organizationWithExtension = addUniqueExtension(org, metriportDataSourceExtension);
  bundleWithExtensions.entry?.push({ resource: patientWithExtension });
  bundleWithExtensions.entry?.push({ resource: organizationWithExtension });

  return bundleWithExtensions;
}

type ReplacementIdPair = { old: string; new: string };

function validateUuidsAndAddExtensions(bundle: ValidBundle, docExtension: Extension): ValidBundle {
  const replacements: ReplacementIdPair[] = [];
  bundle.entry.forEach(entry => {
    const oldId = entry.resource.id;
    if (!oldId) {
      entry.resource.id = uuidv7();
    }
    if (oldId && !isValidUuid(oldId)) {
      replacements.push({
        old: oldId,
        new: uuidv7(),
      });
    }
    addUniqueExtension(entry.resource, metriportDataSourceExtension);
    addUniqueExtension(entry.resource, docExtension);
  });
  let bundleString = JSON.stringify(bundle);
  replacements.forEach((idPair: ReplacementIdPair) => {
    bundleString = bundleString.replaceAll(idPair.old, idPair.new);
  });
  return JSON.parse(bundleString);
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function addUniqueExtension(resource: any, extension: Extension) {
  if (!resource.extension) {
    resource.extension = [];
  }
  const extensionExists = resource.extension.some((ext: Extension) => ext.url === extension.url);
  if (!extensionExists) {
    resource.extension.push(extension);
  }
  return resource;
}
