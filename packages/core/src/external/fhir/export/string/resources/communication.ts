import { Communication } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAttachment } from "../shared/attachment";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatReference, formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Communication resource to a string representation
 */
export class CommunicationToString implements FHIRResourceToString<Communication> {
  toString(communication: Communication, isDebug?: boolean): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const identifierStr = formatIdentifiers({ identifiers: communication.identifier });
    if (identifierStr) parts.push(identifierStr);

    if (communication.status) {
      parts.push(isDebug ? `Status: ${communication.status}` : communication.status);
    }

    const categoryStr = formatCodeableConcepts({
      concepts: communication.category,
      label: "Category",
      isDebug,
    });
    if (categoryStr) parts.push(categoryStr);

    if (communication.priority) {
      parts.push(isDebug ? `Priority: ${communication.priority}` : communication.priority);
    }

    // if (communication.subject) {
    //   const subjectStr = formatReferences([communication.subject], "Subject");
    //   if (subjectStr) parts.push(subjectStr);
    // }

    const senderStr = formatReference({
      reference: communication.sender,
      label: "Sender",
      isDebug,
    });
    if (senderStr) parts.push(senderStr);

    const recipientStr = formatReferences({
      references: communication.recipient,
      label: "Recipient",
      isDebug,
    });
    if (recipientStr) parts.push(recipientStr);

    const topicStr = formatCodeableConcept({
      concept: communication.topic,
      label: "Topic",
      isDebug,
    });
    if (topicStr) {
      parts.push(topicStr);
      hasMinimumData = true;
    }

    if (communication.medium) {
      const mediumStr = formatCodeableConcepts({
        concepts: communication.medium,
        label: "Medium",
        isDebug,
      });
      if (mediumStr) parts.push(mediumStr);
    }

    if (communication.sent) {
      parts.push(isDebug ? `Sent: ${communication.sent}` : communication.sent);
    }

    if (communication.received) {
      parts.push(isDebug ? `Received: ${communication.received}` : communication.received);
    }

    if (communication.reasonCode) {
      const reasonStr = formatCodeableConcepts({
        concepts: communication.reasonCode,
        label: "Reason",
        isDebug,
      });
      if (reasonStr) {
        parts.push(reasonStr);
        hasMinimumData = true;
      }
    }

    if (communication.payload) {
      const payloads = communication.payload
        .map(payload => {
          const { contentString, contentAttachment, contentReference } = payload;
          const components = [
            contentString && (isDebug ? `Content: ${contentString}` : contentString),
            formatAttachment({ attachment: contentAttachment, isDebug }),
            formatReference({ reference: contentReference, label: "Content Ref", isDebug }),
          ].filter(Boolean);
          return components.join(FIELD_SEPARATOR);
        })
        .filter(Boolean);

      if (payloads.length > 0) {
        const payloadStr = payloads.join(FIELD_SEPARATOR);
        parts.push(isDebug ? `Payloads: ${payloadStr}` : payloadStr);
        hasMinimumData = true;
      }
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
