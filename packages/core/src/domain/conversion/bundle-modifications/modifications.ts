import { Bundle, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { isPatient } from "../../../external/fhir/shared";
import { DOC_ID_EXTENSION_URL } from "../../../external/fhir/shared/extensions/doc-id-extension";
import { uuidv7 } from "../../../util/uuid-v7";

export type FhirExtension = {
  url: string;
  valueString: string;
};

export type FhirConverterParams = {
  patientId: string;
  fileName: string;
  unusedSegments: string | undefined;
  invalidAccess: string | undefined;
};

/**
 * Replaces the IDs (and all references to them) for all resources that have an extension for the source document.
 * This is done so that identical resources originated from different sources would have different IDs.
 */
export function replaceIdsForResourcesWithDocExtension(
  fhirBundle: Bundle<Resource>,
  patientId: string
): Bundle<Resource> {
  const updatedBundle = cloneDeep(fhirBundle);
  const stringsToReplace: { old: string; new: string }[] = [];
  if (!updatedBundle.entry || updatedBundle.entry.length === 0) {
    throw new Error(`Missing bundle entries`);
  }
  for (const bundleEntry of updatedBundle.entry) {
    if (!bundleEntry.resource) continue;
    if (!bundleEntry.resource.id) continue;
    if (bundleEntry.resource.id === patientId) continue;

    const resource = bundleEntry.resource;
    if ("extension" in resource) {
      const docIdExtension = resource.extension?.find(ext => ext.url === DOC_ID_EXTENSION_URL);
      const idToUse = bundleEntry.resource.id;
      const newId = uuidv7();
      stringsToReplace.push({ old: idToUse, new: newId });
      // replace meta's source and profile
      bundleEntry.resource.meta = {
        lastUpdated: bundleEntry.resource.meta?.lastUpdated ?? new Date().toISOString(),
        source: docIdExtension?.valueString ?? "",
      };
    }
  }
  let updatedBundleStr = JSON.stringify(updatedBundle);
  for (const stringToReplace of stringsToReplace) {
    const regex = new RegExp(stringToReplace.old, "g");
    updatedBundleStr = updatedBundleStr.replace(regex, stringToReplace.new);
  }

  return JSON.parse(updatedBundleStr);
}

export function addExtensionToConversion(
  fhirBundle: Bundle<Resource>,
  extension: FhirExtension
): Bundle<Resource> {
  const updatedBundle = cloneDeep(fhirBundle);
  if (updatedBundle?.entry?.length) {
    for (const bundleEntry of updatedBundle.entry) {
      const resource = bundleEntry.resource;
      if (!resource) continue;
      if (!("extension" in resource)) {
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        (resource as any).extension = [extension];
      } else {
        resource.extension?.push(extension);
      }
    }
  }
  return updatedBundle;
}

export function removePatientFromConversion(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  if (!fhirBundle.entry) return fhirBundle;
  const updatedBundle = cloneDeep(fhirBundle);
  if (!updatedBundle.entry) return fhirBundle;

  updatedBundle.entry = updatedBundle.entry?.filter(entry => !isPatient(entry.resource));
  return updatedBundle;
}
