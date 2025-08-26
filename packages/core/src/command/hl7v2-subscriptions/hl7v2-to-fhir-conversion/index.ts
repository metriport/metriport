import { Hl7Message } from "@medplum/core";
import { Bundle, Extension, Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { BundleWithEntry, buildBundleFromResources } from "../../../external/fhir/bundle/bundle";
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
};

/**
 * Converts an HL7v2 message to a FHIR Bundle. Currently only supports ADT messages.
 */
export function convertHl7v2MessageToFhir({
  cxId,
  patientId,
  message,
  rawDataFileKey,
  hieName,
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
    return addHl7SourceExtensions(bundle, [docIdExtension, sourceExtension]);
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

function addHl7SourceExtensions(
  bundle: BundleWithEntry<Resource>,
  newExtensions: Extension[]
): Bundle<Resource> {
  return {
    ...bundle,
    entry: bundle.entry.map(e => {
      if (!e.resource) return e;
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resource = e.resource as any;
      const existing = resource.extension ?? [];
      return {
        ...e,
        resource: {
          ...e.resource,
          extension: [...existing, ...newExtensions],
        },
      };
    }),
  };
}
