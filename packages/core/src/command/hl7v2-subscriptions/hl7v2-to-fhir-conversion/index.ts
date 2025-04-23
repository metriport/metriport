import { Hl7Message } from "@medplum/core";
import { Bundle, Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { BundleWithEntry, buildBundleFromResources } from "../../../external/fhir/shared/bundle";
import { buildDocIdFhirExtension } from "../../../external/fhir/shared/extensions/doc-id-extension";
import { capture, out } from "../../../util";
import { mapEncounterAndRelatedResources } from "./adt/encounter";
import { getHl7MessageTypeOrFail, getMessageUniqueIdentifier } from "./msh";
import { buildHl7MessageFileKey } from "./shared";

export type Hl7ToFhirParams = {
  cxId: string;
  patientId: string;
  hl7Message: Hl7Message;
  timestampString: string;
};

/**
 * Converts an HL7v2 message to a FHIR Bundle. Currently only supports ADT messages.
 */
export function convertHl7v2MessageToFhir({
  cxId,
  patientId,
  hl7Message,
  timestampString,
}: Hl7ToFhirParams): Bundle<Resource> {
  const { log } = out(`hl7v2 to fhir - cx: ${cxId}, pt: ${patientId}`);
  log("Beginning conversion.");

  const startedAt = new Date();
  const { messageCode, triggerEvent } = getHl7MessageTypeOrFail(hl7Message);
  const messageId = getMessageUniqueIdentifier(hl7Message);

  const filePath = buildHl7MessageFileKey({
    cxId,
    patientId,
    timestamp: timestampString,
    messageId,
    messageCode,
    triggerEvent,
    extension: "hl7",
  });

  if (messageCode === "ADT") {
    const resources = mapEncounterAndRelatedResources(hl7Message, patientId);
    const bundle = buildBundleFromResources({ type: "collection", resources });
    const duration = elapsedTimeFromNow(startedAt);

    log(`Conversion completed in ${duration} ms`);
    return addHl7SourceExtension(bundle, filePath);
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

function addHl7SourceExtension(
  bundle: BundleWithEntry<Resource>,
  sourcePath: string
): Bundle<Resource> {
  const ext = buildDocIdFhirExtension(sourcePath);
  return {
    ...bundle,
    entry: bundle.entry.map(e => {
      if (!e.resource) return e;
      return {
        ...e,
        resource: {
          ...e.resource,
          extension: [ext],
        },
      };
    }),
  };
}
