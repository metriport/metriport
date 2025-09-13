import { Bundle, Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { cloneDeep } from "lodash";
import { isPatient } from "../../../external/fhir/shared";
import { createExtensionSourceReference } from "../../../external/fhir/shared/extensions/source-reference-extension";
import { capture } from "../../../util";
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
  patientId: string,
  documentExtension: FhirExtension
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
    // TODO: 2574 - Make sure IDs are replaced for all relevant resources - not just the ones with extensions
    if ("extension" in resource) {
      const idToUse = bundleEntry.resource.id;
      const newId = uuidv7();
      stringsToReplace.push({ old: idToUse, new: newId });
      // replace meta's source and profile
      bundleEntry.resource.meta = {
        lastUpdated: bundleEntry.resource.meta?.lastUpdated ?? new Date().toISOString(),
        source: documentExtension.valueString ?? "",
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
  documentExtension: FhirExtension
): Bundle<Resource> {
  const docRefId = getDocRefIdFromDocumentExtension(documentExtension);
  const docRefExtension = createExtensionSourceReference("DocumentReference", docRefId);

  const updatedBundle = cloneDeep(fhirBundle);
  if (updatedBundle?.entry?.length) {
    for (const bundleEntry of updatedBundle.entry) {
      const resource = bundleEntry.resource;
      if (!resource) continue;
      if (!("extension" in resource)) {
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        (resource as any).extension = [docRefExtension];
        // (resource as any).extension = [documentLocationExtension, docRefExtension];
      } else {
        resource.extension?.push(docRefExtension);
        // resource.extension?.push(documentLocationExtension, docRefExtension);
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

export function getDocRefIdFromDocumentExtension(
  documentExtension: FhirExtension,
  log?: typeof console.log
): string {
  const docRefId = documentExtension.valueString.split("_").pop()?.split(".")[0];
  if (!docRefId) {
    const msg = `Document extension value string does not contain a docRefId`;
    log && log(`${msg} - documentExtension: ${JSON.stringify(documentExtension)}`);
    capture.error(msg, {
      extra: {
        documentExtension,
      },
    });
    throw new MetriportError(msg, undefined, {
      documentExtension: JSON.stringify(documentExtension),
    });
  }
  return docRefId;
}
