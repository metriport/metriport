import { toArray } from "@metriport/shared";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { BINARY_MIME_TYPES } from "../../util/mime";

const notesTemplateId = "2.16.840.1.113883.10.20.22.2.65";
const b64Representation = "B64";

export function removeBase64PdfEntries(payloadRaw: string): string {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
  });
  const json = parser.parse(payloadRaw);

  let removedEntry = 0;

  if (json.ClinicalDocument?.component?.structuredBody?.component) {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    toArray(json.ClinicalDocument.component.structuredBody.component).forEach((comp: any) => {
      if (
        toArray(comp.section?.templateId).some(
          //eslint-disable-next-line @typescript-eslint/no-explicit-any
          (template: any) => template?.["@_root"] === notesTemplateId
        )
      ) {
        if (comp.section.entry) {
          //eslint-disable-next-line @typescript-eslint/no-explicit-any
          comp.section.entry = toArray(comp.section.entry).filter((entry: any) => {
            const mediaType = entry.act?.text?.["@_mediaType"]?.trim().toLowerCase();
            if (
              BINARY_MIME_TYPES.includes(mediaType) &&
              entry.act.text["@_representation"]?.trim().toLowerCase() ===
                b64Representation.toLowerCase()
            ) {
              removedEntry++;
              return false;
            }
            return true;
          });
        }
      }
    });
  }

  const builder = new XMLBuilder({
    format: false,
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    suppressEmptyNode: true,
    suppressBooleanAttributes: false,
  });
  const xml = builder.build(json);
  return removedEntry > 0 ? xml : payloadRaw;
}
