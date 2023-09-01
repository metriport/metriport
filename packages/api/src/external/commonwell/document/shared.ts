import { Document, DocumentContent, HumanName } from "@metriport/commonwell-sdk";
import { contentType, extension } from "mime-types";
import { Patient } from "../../../models/medical/patient";
import { OrganizationDTO } from "../../../routes/medical/dtos/organizationDTO";

export const sandboxSleepTime = 5000;

export type DocumentWithMetriportId = Document & {
  originalId: string;
};

export type DocumentWithLocation = DocumentWithMetriportId & { content: { location: string } };

export type CWDocumentWithMetriportData = DocumentWithMetriportId & {
  metriport: {
    fileName: string;
    location: string;
    fileSize: number | undefined;
  };
};

export type DocumentReferenceExtras = {
  organization?: Partial<OrganizationDTO>;
  practitioner?: {
    name: HumanName;
  };
  facilityType?: string;
};

export function getFileName(patient: Patient, doc: Document): string {
  const prefix = "document_" + patient.id;
  const display = doc.content?.type?.coding?.length
    ? doc.content?.type.coding[0]?.display
    : undefined;
  const suffix = getSuffix(doc.id);
  const extension = getFileExtension(doc.content?.mimeType);
  const fileName = `${prefix}_${display ? display + "_" : display}${suffix}${extension}`;
  return fileName.replace(/\s/g, "-");
}

function getSuffix(id: string | undefined): string {
  if (!id) return "";
  return id.replace("urn:uuid:", "");
}

export function getFileExtension(value: string | undefined): string {
  if (!value || !contentType(value)) return "";
  const fileExtension = extension(value);
  return fileExtension ? `.${fileExtension}` : "";
}

export function getExtraDocRefInfo(content: DocumentContent | undefined): DocumentReferenceExtras {
  const extraInfo: DocumentReferenceExtras = {};
  const contained = content?.contained;
  const context = content?.context;

  if (contained) {
    contained.forEach(item => {
      const containedName = item.name;
      if (item.resourceType === "Organization") {
        if (typeof containedName === "string") {
          extraInfo.organization = {
            name: containedName,
          };
        }
      } else if (item.resourceType === "Practitioner" && containedName) {
        if (Array.isArray(containedName)) {
          const name = containedName[0];
          if (name) addPractitionerName(extraInfo, name);
        } else if (typeof containedName === "object") {
          addPractitionerName(extraInfo, containedName);
        }
      }
    });
  }

  if (context?.facilityType?.text) {
    extraInfo.facilityType = context.facilityType.text;
  }
  return extraInfo;
}

export function addPractitionerName(extraInfo: DocumentReferenceExtras, name: HumanName): void {
  if (name && name.given?.length && name.given[0] != "") {
    extraInfo.practitioner = {
      name: {
        given: name.given,
        family: name.family,
        prefix: name.prefix?.length && name.prefix[0] !== "" ? name.prefix : undefined,
      },
    };
  }
}
