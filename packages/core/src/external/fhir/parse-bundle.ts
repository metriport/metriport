import { Bundle, Extension } from "@medplum/fhirtypes";
import { Config } from "../../util/config";
import { uuidv4 } from "../../util/uuid-v7";
import { DOC_ID_EXTENSION_URL } from "./shared/extensions/doc-id-extension";

const placeholderReplaceRegex = new RegExp("66666666-6666-6666-6666-666666666666", "g");
const metriportPrefixRegex = new RegExp("Metriport/identifiers/Metriport/", "g");

// Moved here from sqs-to-fhir.ts

export function parseRawBundleForFhirServer(payloadRaw: string, patientId: string): Bundle {
  let payload: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (Config.isSandbox()) {
    const payloadWithReplacedIds = replaceIds(payloadRaw);
    const payloadWithReplacedIdsAndPrefix = replacePrefixes(payloadWithReplacedIds);
    const payloadWithReplacedPlaceholders = replacePlaceholders(
      payloadWithReplacedIdsAndPrefix,
      patientId
    );
    payload = JSON.parse(payloadWithReplacedPlaceholders);
  } else {
    payload = JSON.parse(payloadRaw);
  }
  // light validation to make sure it's a bundle
  if (payload.resourceType !== "Bundle") {
    throw new Error(`Not a FHIR Bundle`);
  }
  return payload;
}

function replaceIds(payload: string): string {
  const fhirBundle = JSON.parse(payload);
  const stringsToReplace: { old: string; new: string }[] = [];
  for (const bundleEntry of fhirBundle.entry) {
    // validate resource id
    const idToUse = bundleEntry.resource.id;
    const newId = uuidv4();
    const docIdExtension = bundleEntry.resource.extension?.find(
      (ext: { url: string }) => ext.url === DOC_ID_EXTENSION_URL
    ) as Extension | undefined;
    bundleEntry.resource.id = newId;
    stringsToReplace.push({ old: idToUse, new: newId });
    // replace meta's source and profile
    bundleEntry.resource.meta = {
      lastUpdated: bundleEntry.resource.meta?.lastUpdated ?? new Date().toISOString(),
      source: docIdExtension?.valueString ?? "",
    };
  }
  let fhirBundleStr = JSON.stringify(fhirBundle);
  for (const stringToReplace of stringsToReplace) {
    // doing this is apparently more efficient than just using replace
    const regex = new RegExp(stringToReplace.old, "g");
    fhirBundleStr = fhirBundleStr.replace(regex, stringToReplace.new);
  }
  return fhirBundleStr;
}

function replacePrefixes(payload: string): string {
  return payload.replace(metriportPrefixRegex, "");
}

function replacePlaceholders(payload: string, patientId: string): string {
  return payload.replace(placeholderReplaceRegex, patientId);
}
