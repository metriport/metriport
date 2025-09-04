import { BadRequestError, toArray } from "@metriport/shared";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import { XMLBuilder } from "fast-xml-parser";
import { cloneDeep } from "lodash";
import {
  CdaOriginalText,
  CdaValueEd,
  ConcernActEntryAct,
  ObservationOrganizer,
} from "../../fhir-to-cda/cda-types/shared-types";
import { detectFileType } from "../../util/file-type";
import { BINARY_MIME_TYPES, OCTET_MIME_TYPE, TXT_MIME_TYPE } from "../../util/mime";
import { groupObservations, isConcernActEntry, isObservationOrganizer } from "./shared";

// This is the most straightforward instructions we normally see in CCDAs
const xmlProcessingInstructions = `<?xml version="1.0" encoding="UTF-8"?>`;

const notesTemplateId = "2.16.840.1.113883.10.20.22.2.65";
const resultsTemplateId = "2.16.840.1.113883.10.20.22.2.3.1";
const b64Representation = "B64";

export type B64Attachments = {
  acts: ConcernActEntryAct[];
  organizers: ObservationOrganizer[];
  total: number;
};

export function removeBase64PdfEntries(payloadRaw: string): {
  documentContents: string;
  b64Attachments: B64Attachments | undefined;
} {
  const json = getJsonFromXml(payloadRaw);

  const b64Attachments: B64Attachments = {
    acts: [],
    organizers: [],
    total: 0,
  };

  if (json.ClinicalDocument?.component?.structuredBody?.component) {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    toArray(json.ClinicalDocument.component.structuredBody.component).forEach((comp: any) => {
      if (
        toArray(comp.section?.templateId).some(
          //eslint-disable-next-line @typescript-eslint/no-explicit-any
          (template: any) =>
            template?.["_root"] === notesTemplateId || template?.["_root"] === resultsTemplateId
        )
      ) {
        if (comp.section.entry) {
          //eslint-disable-next-line @typescript-eslint/no-explicit-any
          comp.section.entry = toArray(comp.section.entry).filter((entry: any) => {
            if (isConcernActEntry(entry)) {
              const act = entry.act;
              if (
                isBinaryMimeTypeOrUndefined(act.text?._mediaType) &&
                isB64Representation(act.text?._representation) &&
                !isTextAttachment(act.text)
              ) {
                b64Attachments.total++;
                b64Attachments.acts.push(act);
                return false;
              }
            } else if (isObservationOrganizer(entry)) {
              const { mediaObservations, nonMediaObservations } = groupObservations(
                entry.organizer
              );
              // TODO: 2474: Apparently, some XML have B64 attachments in regular observations, so need to account for that as well
              if (mediaObservations.length === 0) return true;

              const filteredMediaComponents = mediaObservations.filter(obs => {
                const val = obs.observationMedia.value;

                if (
                  isBinaryMimeTypeOrUndefined(val?._mediaType) &&
                  isB64Representation(val?._representation) &&
                  !isTextAttachment(val)
                ) {
                  b64Attachments.organizers.push(cloneDeep(entry.organizer));
                  b64Attachments.total++;
                  return false;
                }
                return true;
              });

              const remainingComponents = [...nonMediaObservations, ...filteredMediaComponents];
              entry.organizer.component = remainingComponents;
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
    attributeNamePrefix: "_",
    suppressEmptyNode: true,
    suppressBooleanAttributes: false,
  });
  const xml = builder.build(json);

  return {
    documentContents: xml,
    b64Attachments: b64Attachments.total > 0 ? b64Attachments : undefined,
  };
}

function isBinaryMimeTypeOrUndefined(mediaType: string | undefined): boolean {
  const mediaTypeClean = mediaType?.trim().toLowerCase();
  if (!mediaTypeClean) return true;

  return BINARY_MIME_TYPES.includes(mediaTypeClean);
}

function isB64Representation(rep: string | undefined): boolean {
  return rep?.trim().toLowerCase() === b64Representation.toLowerCase();
}

function isTextAttachment(attachment: CdaOriginalText | CdaValueEd | undefined): boolean {
  const attachmentContents = attachment?.["#text"];
  if (!attachmentContents) return false;

  const fileBuffer = Buffer.from(attachmentContents, "base64");
  const mimeType = detectFileType(fileBuffer).mimeType;
  if (mimeType === OCTET_MIME_TYPE && attachment._mediaType?.includes("text")) {
    return true;
  }

  return mimeType === TXT_MIME_TYPE;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getJsonFromXml(payloadRaw: string): any {
  const parser = createXMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    removeNSPrefix: true,
  });

  try {
    return parser.parse(payloadRaw);
  } catch (error) {
    return parser.parse(sanitizeXmlProcessingInstructions(payloadRaw));
  }
}

/**
 * Sometimes, the XML processing instructions are faulty, resulting in a parse error.
 * For example, sometimes they indicate it as being a text file, rather than XML,
 * which is why we need to sanitize the XML processing instructions.
 */
export function sanitizeXmlProcessingInstructions(xml: string): string {
  const indexOfDocumentStart = xml.indexOf("<Clinical");
  if (indexOfDocumentStart === -1) {
    throw new BadRequestError("No ClinicalDocument found in XML");
  }

  return xmlProcessingInstructions.concat(xml.substring(indexOfDocumentStart));
}
