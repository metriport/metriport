import { toArray } from "@metriport/shared";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import { XMLBuilder } from "fast-xml-parser";
import { ConcernActEntry, ObservationOrganizer } from "../../fhir-to-cda/cda-types/shared-types";
import { BINARY_MIME_TYPES } from "../../util/mime";
import { getMediaObservations, isConcernActEntry, isObservationOrganizer } from "./shared";

const notesTemplateId = "2.16.840.1.113883.10.20.22.2.65";
const resultsTemplateId = "2.16.840.1.113883.10.20.22.2.3.1";
const b64Representation = "B64";

export type B64Attachments = {
  acts: ConcernActEntry[];
  organizers: ObservationOrganizer[];
  total: number;
};

export function removeBase64PdfEntries(payloadRaw: string): {
  documentContents: string;
  b64Attachments: B64Attachments | undefined;
} {
  const parser = createXMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    removeNSPrefix: true,
  });
  const json = parser.parse(payloadRaw);

  let isRemovedEntries;

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
              const mediaType = entry.act?.text?.["_mediaType"]?.trim().toLowerCase();
              if (
                (mediaType == undefined || BINARY_MIME_TYPES.includes(mediaType)) &&
                isB64Representation(entry.act?.text?.["_representation"])
              ) {
                isRemovedEntries = true;
                b64Attachments.acts.push(entry);
                b64Attachments.total++;
                return false;
              }
            } else if (isObservationOrganizer(entry)) {
              const mediaComponent = getMediaObservations(entry);
              // TODO: Apparently, some XML have B64 attachments in regular observations, so need to account for that as well
              if (!mediaComponent?.length) return true;

              let filterOut = false;
              mediaComponent.map(comp => {
                const val = comp.observationMedia.value;
                const mediaType = val?._mediaType?.trim().toLowerCase();
                if (
                  (mediaType == undefined || BINARY_MIME_TYPES.includes(mediaType)) &&
                  isB64Representation(val?._representation)
                ) {
                  filterOut = true;
                }
              });
              if (filterOut) {
                b64Attachments.organizers.push(entry);
                b64Attachments.total++;
                isRemovedEntries = true;
                return false;
              }
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
    documentContents: isRemovedEntries ? xml : payloadRaw,
    b64Attachments: b64Attachments.total > 0 ? b64Attachments : undefined,
  };
}

function isB64Representation(rep: string | undefined): boolean {
  return rep?.trim().toLowerCase() === b64Representation.toLowerCase();
}
