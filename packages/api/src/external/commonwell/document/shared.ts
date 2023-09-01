import { Organization, Practitioner } from "@medplum/fhirtypes";
import { Contained, Document, HumanName } from "@metriport/commonwell-sdk";
import { contentType, extension } from "mime-types";
import { Patient } from "../../../models/medical/patient";
import { ResourceType } from "../../fhir/shared";

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

export type ExtraResources = {
  organization?: Organization;
  practitioner?: Practitioner[];
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

export function getExtraResources(contained: Contained[] | undefined | null): ExtraResources {
  const resources: ExtraResources = {};
  if (!contained) return resources;

  contained.forEach(item => {
    const containedName = item.name;
    if (item.resourceType === "Organization") {
      resources.organization = getOrganizationResource(item);
    } else if (item.resourceType === "Practitioner" && containedName) {
      if (!resources.practitioner) resources.practitioner = [];
      resources.practitioner.push(getPractitionerResource(item));
    }
  });

  return resources;
}

function getOrganizationResource(item: Contained): Organization {
  const org: Organization = {
    resourceType: ResourceType.Organization,
  };
  if (typeof item.name === "string") {
    org.name = item.name;
  } else if (Array.isArray(item.name)) {
    org.name = item.name[0] && item.name[0].text ? item.name[0].text : undefined;
  } else if (typeof item.name === "object") {
    org.name = item.name && item.name.text ? item.name?.text : undefined;
  }
  return org;
}

function getPractitionerResource(item: Contained): Practitioner {
  const practitioner: Practitioner = {
    resourceType: ResourceType.Practitioner,
  };
  const containedName = item.name;

  if (containedName) {
    if (typeof containedName === "string") {
      practitioner.name = [{ family: containedName }];
    } else if (Array.isArray(containedName)) {
      containedName.forEach(name => {
        if (!practitioner.name) practitioner.name = [];

        practitioner.name.push(getPractitionerName(name));
      });
    } else {
      practitioner.name = [getPractitionerName(containedName)];
    }
  }
  return practitioner;
}

function getPractitionerName(name: HumanName) {
  return {
    given: name.given,
    family: name.family[0],
    prefix:
      name.prefix && Array.isArray(name.prefix) && name.prefix[0] !== "" ? name.prefix : undefined,
  };
}
