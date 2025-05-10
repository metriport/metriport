import { Attachment, DiagnosticReport } from "@medplum/fhirtypes";
import { cleanUpNote } from "../../../domain/ai-brief/modify-resources";
import { base64ToString } from "../../../util/base64";

export function presentedFormsToText(report: DiagnosticReport): string[] {
  if (!report.presentedForm) return [];
  const res = report.presentedForm.flatMap(form => {
    const text = attachmentToText(form);
    if (text) return [text];
    return [];
  });
  return res;
}

/**
 * Consider:
 * - convert based on `contentType`
 * - download the attachment and convert to text?
 */
export function attachmentToText(attachment: Attachment): string | undefined {
  if (!attachment.data) return undefined;
  if (attachment.language && !attachment.language.startsWith("en")) return undefined;
  const formTextRaw = base64ToString(attachment.data);
  const text = cleanUpNote(formTextRaw);
  return text;
}
