import { Hl7Message } from "@medplum/core";
import { Bundle, Extension, Patient, Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import {
  buildBundleEntry,
  buildBundleFromResources,
  buildCollectionBundle,
} from "../../../external/fhir/bundle/bundle";
import { buildDocIdFhirExtension } from "../../../external/fhir/shared/extensions/doc-id-extension";
import { capture, out } from "../../../util";
import { convertAdtToFhirResources } from "./adt/encounter";
import { getHl7MessageTypeOrFail } from "./msh";
import { createExtensionDataSource } from "../../../external/fhir/shared/extensions/extension";

export type Hl7ToFhirParams = {
  cxId: string;
  patientId: string;
  message: Hl7Message;
  rawDataFileKey: string;
  hieName: string;
  fhirPatient: Patient;
};
export type ResourceWithExtension = Resource & { extension?: Extension[] };

/**
 * Converts an HL7v2 message to a FHIR Bundle. Currently only supports ADT messages.
 */
export function convertHl7v2MessageToFhir({
  cxId,
  patientId,
  message,
  rawDataFileKey,
  hieName,
  fhirPatient,
}: Hl7ToFhirParams): Bundle<Resource> {
  const { log } = out(`hl7v2 to fhir - cx: ${cxId}, pt: ${patientId}`);
  log("Beginning conversion.");

  const startedAt = new Date();
  const { messageCode } = getHl7MessageTypeOrFail(message);

  if (messageCode === "ADT") {
    const resources = convertAdtToFhirResources(message, patientId);
    const bundle = buildBundleFromResources({ type: "collection", resources });
    const duration = elapsedTimeFromNow(startedAt);

    log(`Conversion completed in ${duration} ms`);
    const docIdExtension = buildDocIdFhirExtension(rawDataFileKey, "hl7");
    const sourceExtension = createExtensionDataSource(hieName.toUpperCase());
    const newEncounterData = prependPatientToBundle({
      bundle: bundle,
      fhirPatient,
    });
    const updatedBundle = appendExtensionToEachResource(
      appendExtensionToEachResource(newEncounterData, docIdExtension),
      sourceExtension
    );
    return updatedBundle;
  }

  const msg = "HL7 message type isn't supported";
  log(`${msg} ${messageCode}. Skipping conversion.`);

  const extraProps = {
    patientId,
    cxId,
    messageCode,
  };

  capture.message(msg, {
    extra: extraProps,
    level: "info",
  });

  throw new MetriportError(msg, undefined, extraProps);
}

export function appendExtensionToEachResource(
  bundle: Bundle<Resource>,
  newExtension: Extension
): Bundle<Resource> {
  if (!bundle.entry) {
    throw new Error("No entry in bundle");
  }
  return {
    ...bundle,
    entry: bundle.entry.map(e => {
      const resource = e.resource;
      if (!resource) return e;

      const existing: Extension[] = (resource as ResourceWithExtension).extension ?? [];
      const extension = [...existing, newExtension];

      return {
        ...e,
        resource: {
          ...resource,
          extension: extension,
        } as Resource,
      };
    }),
  };
}

function prependPatientToBundle({
  bundle,
  fhirPatient,
}: {
  bundle: Bundle<Resource>;
  fhirPatient: Resource;
}): Bundle<Resource> {
  const fhirPatientEntry = buildBundleEntry(fhirPatient);
  const combinedEntries = bundle.entry ? [fhirPatientEntry, ...bundle.entry] : [];
  return buildCollectionBundle(combinedEntries);
}
