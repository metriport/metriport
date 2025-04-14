import { Hl7Message } from "@medplum/core";
import { Bundle, Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { BundleWithEntry, buildBundleFromResources } from "../../../external/fhir/shared/bundle";
import { buildDocIdFhirExtension } from "../../../external/fhir/shared/extensions/doc-id-extension";
import { capture, out } from "../../../util";
import { mapEncounterAndRelatedResources } from "./adt/encounter";
import { getMessageTypeOrFail } from "./msh";
import { buildHl7MessageFileKey } from "./shared";

export type Hl7ToFhirParams = {
  hl7Message: Hl7Message;
  cxId: string;
  patientId: string;
  timestampString: string;
};

/**
 * Converts an HL7v2 message to a FHIR Bundle. Currently only supports ADT messages.
 */
export function convertHl7v2MessageToFhir({
  hl7Message,
  cxId,
  patientId,
  timestampString,
}: Hl7ToFhirParams): Bundle<Resource> {
  const { log } = out(`hl7v2 to fhir - cx: ${cxId}, pt: ${patientId}`);
  log("Beginning conversion.");

  const startedAt = new Date();
  const messageType = getMessageTypeOrFail(hl7Message);
  const filePath = buildHl7MessageFileKey({
    cxId,
    patientId,
    timestamp: timestampString,
    messageType: messageType.structure,
    messageCode: messageType.code,
  });

  if (messageType.code === "ADT") {
    const resources = mapEncounterAndRelatedResources(hl7Message, patientId);
    const bundle = buildBundleFromResources({ type: "collection", resources });
    const duration = elapsedTimeFromNow(startedAt);

    log(`Conversion completed in ${duration} ms`);
    return addHl7SourceExtension(bundle, filePath);
  }

  const msg = "HL7 message type isn't supported";
  log(`${msg} ${messageType.code}. Skipping conversion.`);

  const extraProps = {
    patientId,
    cxId,
    messageType: JSON.stringify(messageType),
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
  return { ...bundle, entry: bundle.entry.map(e => ({ ...e, extension: [ext] })) };
}
