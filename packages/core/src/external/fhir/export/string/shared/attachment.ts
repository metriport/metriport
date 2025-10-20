import { Attachment } from "@medplum/fhirtypes";
import { base64ToString } from "../../../../../util/base64";
import { TXT_MIME_TYPE } from "../../../../../util/mime";
import { defaultIsDebug } from "./debug";
import { FIELD_SEPARATOR } from "./separator";

// Consider expanding this to TXT_RTF_MIME_TYPE and HTML_MIME_TYPE, but we'd need a parser to
// clean up the data, removing metadata and tags.
const conversibleContentTypes = [TXT_MIME_TYPE];

/**
 * Formats a FHIR attachment into a string representation
 */
export function formatAttachment({
  attachment,
  label,
  isDebug = defaultIsDebug,
}: {
  attachment: Attachment | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!attachment) return undefined;
  if (!attachment.data || !attachment.contentType) return undefined;
  if (!conversibleContentTypes.includes(attachment.contentType)) return undefined;
  const { data, contentType, title } = attachment;
  const components = [
    isDebug ? `Data: ${base64ToString(data)}` : base64ToString(data),
    isDebug ? `Content Type: ${contentType}` : contentType,
    title && isDebug ? `Title: ${title}` : title,
    // attachment.language && `Language: ${attachment.language}`,
    // attachment.url && `URL: ${attachment.url}`,
    // attachment.size && `Size: ${attachment.size} bytes`,
    // attachment.hash && `Hash: ${attachment.hash}`,
    // attachment.creation && `Created: ${attachment.creation}`,
  ].filter(Boolean);
  if (components.length < 1) return undefined;
  const formatted = components.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formatted}` : formatted;
}

/**
 * Formats a list of FHIR attachments into a string representation
 */
export function formatAttachments({
  attachments,
  label,
  isDebug = defaultIsDebug,
}: {
  attachments: Attachment[] | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!attachments?.length) return undefined;
  const formattedList = attachments
    .map(attachment => formatAttachment({ attachment, isDebug }))
    .filter(Boolean);
  if (formattedList.length < 1) return undefined;
  const formatted = formattedList.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formatted}` : formatted;
}
