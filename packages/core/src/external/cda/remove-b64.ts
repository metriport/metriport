import { toArray } from "@metriport/shared";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import { XMLBuilder } from "fast-xml-parser";
import { cloneDeep } from "lodash";
import {
  CdaOriginalText,
  CdaValueEd,
  ConcernActEntryAct,
  ObservationEntry,
  ObservationOrganizer,
} from "../../fhir-to-cda/cda-types/shared-types";
import { detectFileType } from "../../util/file-type";
import { BINARY_MIME_TYPES, OCTET_MIME_TYPE, TXT_MIME_TYPE } from "../../util/mime";
import { groupObservations, isConcernActEntry, isObservationOrganizer } from "./shared";

const notesTemplateId = "2.16.840.1.113883.10.20.22.2.65";
const resultsTemplateId = "2.16.840.1.113883.10.20.22.2.3.1";
const b64Representation = "B64";

export type B64Attachments = {
  acts: ConcernActEntryAct[];
  nonMediaObservations: ObservationEntry[];
  organizers: ObservationOrganizer[];
  total: number;
};

type B64NonMediaObservationValue = {
  _representation?: string;
  _mediaType?: string;
  "#text"?: string;
};

export function removeBase64PdfEntries(payloadRaw: string): {
  documentContents: string;
  b64Attachments: B64Attachments | undefined;
} {
  const json = getJsonFromXml(payloadRaw);

  const b64Attachments: B64Attachments = {
    acts: [],
    organizers: [],
    nonMediaObservations: [],
    total: 0,
  };

  if (json.ClinicalDocument?.component?.structuredBody?.component) {
    const components = toArray(json.ClinicalDocument.component.structuredBody.component);
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    components.forEach((comp: any) => {
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

              const filteredNonMediaObservations = nonMediaObservations.filter(obs => {
                const val = obs.observation?.value;
                if (Array.isArray(val)) {
                  const remaining: (typeof val)[number][] = [];
                  for (const item of val) {
                    if (isRemovableB64SingleValueNonMediaObservation(item)) {
                      b64Attachments.total++;
                      const obsClone = cloneDeep(obs);
                      obsClone.observation.value = item;
                      b64Attachments.nonMediaObservations.push(obsClone);
                    } else {
                      remaining.push(item);
                    }
                  }
                  if (remaining.length === 0) return false;
                  // Cast needed: TS widens the manually accumulated array to a mixed element
                  // type, but at runtime we're only removing items so the type is unchanged.
                  obs.observation.value = remaining as typeof val;
                  return true;
                }
                if (isRemovableB64SingleValueNonMediaObservation(val)) {
                  b64Attachments.total++;
                  b64Attachments.nonMediaObservations.push(cloneDeep(obs));
                  return false;
                }
                return true;
              });

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

              const remainingComponents = [
                ...filteredNonMediaObservations,
                ...filteredMediaComponents,
              ];
              if (remainingComponents.length === 0) {
                return false;
              }
              entry.organizer.component = remainingComponents;
            }
            return true;
          });
        }
      }
    });
  }

  if (b64Attachments.total < 1) {
    return {
      documentContents: payloadRaw,
      b64Attachments: undefined,
    };
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
    b64Attachments,
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

  return parser.parse(payloadRaw);
}

/**
 * Checks if the value is a removable B64 single value non media observation.
 * @param val - The value to check.
 * @returns True if the value is a removable B64 single value non media observation, false otherwise.
 */
function isRemovableB64SingleValueNonMediaObservation(val: unknown): boolean {
  if (!val || typeof val !== "object") return false;

  const v = val as B64NonMediaObservationValue;

  // We do not check if the value is not a text attachment because it seems non media observations have large b64 text attachments.
  return (
    isB64Representation(v._representation) &&
    typeof v["#text"] === "string" &&
    isBinaryMimeTypeOrUndefined(v._mediaType)
  );
}
