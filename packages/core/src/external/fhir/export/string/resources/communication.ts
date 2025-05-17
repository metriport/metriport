import { Communication } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAttachment } from "../shared/attachment";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Communication resource to a string representation
 */
export class CommunicationToString implements FHIRResourceToString<Communication> {
  toString(communication: Communication): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    if (communication.identifier) {
      const identifierStr = formatIdentifiers(communication.identifier);
      if (identifierStr) parts.push(identifierStr);
    }

    if (communication.status) {
      parts.push(`Status: ${communication.status}`);
    }

    if (communication.category) {
      const categoryStr = formatCodeableConcepts(communication.category, "Category");
      if (categoryStr) parts.push(categoryStr);
    }

    if (communication.priority) {
      parts.push(`Priority: ${communication.priority}`);
    }

    // if (communication.subject) {
    //   const subjectStr = formatReferences([communication.subject], "Subject");
    //   if (subjectStr) parts.push(subjectStr);
    // }

    if (communication.sender) {
      const senderStr = formatReferences([communication.sender], "Sender");
      if (senderStr) parts.push(senderStr);
    }

    if (communication.recipient) {
      const recipientStr = formatReferences(communication.recipient, "Recipient");
      if (recipientStr) parts.push(recipientStr);
    }

    if (communication.topic) {
      const topicStr = formatCodeableConcepts([communication.topic], "Topic");
      if (topicStr) {
        parts.push(topicStr);
        hasMinimumData = true;
      }
    }

    if (communication.medium) {
      const mediumStr = formatCodeableConcepts(communication.medium, "Medium");
      if (mediumStr) parts.push(mediumStr);
    }

    if (communication.sent) {
      parts.push(`Sent: ${communication.sent}`);
    }

    if (communication.received) {
      parts.push(`Received: ${communication.received}`);
    }

    if (communication.reasonCode) {
      const reasonStr = formatCodeableConcepts(communication.reasonCode, "Reason");
      if (reasonStr) {
        parts.push(reasonStr);
        hasMinimumData = true;
      }
    }

    if (communication.payload) {
      const payloads = communication.payload
        .map(payload => {
          const components = [
            payload.contentString && `Content: ${payload.contentString}`,
            payload.contentAttachment &&
              `Attachment: ${formatAttachment(payload.contentAttachment)}`,
            payload.contentReference && formatReferences([payload.contentReference], "Content"),
          ].filter(Boolean);
          return components.join(FIELD_SEPARATOR);
        })
        .filter(Boolean);

      if (payloads.length > 0) {
        parts.push(`Payloads: ${payloads.join(FIELD_SEPARATOR)}`);
        hasMinimumData = true;
      }
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
