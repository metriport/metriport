import { Attachment } from "@medplum/fhirtypes";
import { base64ToString } from "../../../../../util/base64";
import { TXT_MIME_TYPE } from "../../../../../util/mime";
import { FIELD_SEPARATOR } from "./separator";

// Consider expanding this to TXT_RTF_MIME_TYPE and HTML_MIME_TYPE, but we'd need a parser to
// clean up the data, removing metadata and tags.
const conversibleContentTypes = [TXT_MIME_TYPE];

/**
 * Formats a FHIR attachment into a string representation
 * @param attachment - FHIR attachment to format
 * @returns Formatted string of attachment
 */
export function formatAttachment(attachment: Attachment): string | undefined {
  if (!attachment.data || !attachment.contentType) return undefined;
  if (!conversibleContentTypes.includes(attachment.contentType)) return undefined;
  const components = [
    `Data: ${base64ToString(attachment.data)}`,
    `Content Type: ${attachment.contentType}`,
    attachment.title && `Title: ${attachment.title}`,
    // attachment.language && `Language: ${attachment.language}`,
    // attachment.url && `URL: ${attachment.url}`,
    // attachment.size && `Size: ${attachment.size} bytes`,
    // attachment.hash && `Hash: ${attachment.hash}`,
    // attachment.creation && `Created: ${attachment.creation}`,
  ].filter(Boolean);
  return components.join(FIELD_SEPARATOR);
}

/**
 * Formats a list of FHIR attachments into a string representation
 * @param attachments - List of FHIR attachments to format
 * @returns Formatted string of attachments
 */
export function formatAttachments(attachments: Attachment[] | undefined): string | undefined {
  if (!attachments?.length) return undefined;
  return attachments
    .map(a => formatAttachment(a))
    .filter(Boolean)
    .join(FIELD_SEPARATOR);
}
