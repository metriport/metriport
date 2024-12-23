import { Bundle, Resource } from "@medplum/fhirtypes";
import * as uuid from "uuid";
import { DOC_ID_EXTENSION_URL } from "../../external/fhir/shared/extensions/doc-id-extension";
import { cloneDeep } from "lodash";
import { isPatient } from "../../external/fhir/shared";

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

export function postProcessBundle(
  fhirBundle: Bundle<Resource>,
  patientId: string,
  documentExtension: FhirExtension
) {
  const withNewIds = replaceIDs(fhirBundle, patientId);
  const withExtensions = addExtensionToConversion(withNewIds, documentExtension);
  const withRequests = addMissingRequests(withExtensions);
  const withoutPatient = removePatientFromConversion(withRequests);
  return withoutPatient;
}

export function replaceIDs(fhirBundle: Bundle<Resource>, patientId: string): Bundle<Resource> {
  const updatedBundle = cloneDeep(fhirBundle);
  const stringsToReplace: { old: string; new: string }[] = [];
  if (!updatedBundle.entry || updatedBundle.entry.length === 0) {
    throw new Error(`Missing bundle entries`);
  }
  for (const bundleEntry of updatedBundle.entry) {
    if (!bundleEntry.resource) throw new Error(`Missing resource`);
    if (!bundleEntry.resource.id) throw new Error(`Missing resource id`);
    if (bundleEntry.resource.id === patientId) continue;

    const resource = bundleEntry.resource;
    if ("extension" in resource) {
      const docIdExtension = resource.extension?.find(ext => ext.url === DOC_ID_EXTENSION_URL);
      const idToUse = bundleEntry.resource.id;
      const newId = uuid.v4();
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
    // doing this is apparently more efficient than just using replace
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

export function addMissingRequests(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  const updatedBundle = cloneDeep(fhirBundle);
  if (!updatedBundle?.entry?.length) return updatedBundle;
  updatedBundle.entry.forEach(e => {
    if (!e.request && e.resource) {
      e.request = {
        method: "PUT",
        url: `${e.resource.resourceType}/${e.resource.id}`,
      };
    }
  });
  return updatedBundle;
}

export function removePatientFromConversion(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  const updatedBundle = cloneDeep(fhirBundle);
  const entries = updatedBundle?.entry ?? [];
  const patientEntries = entries.filter(e => isPatient(e.resource));

  if (patientEntries.length > 1) {
    throw new Error("Multiple Patient resources found in Bundle");
  }

  const pos = entries.findIndex(e => isPatient(e.resource));
  if (pos >= 0) updatedBundle.entry?.splice(pos, 1);
  return updatedBundle;
}
