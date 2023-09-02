import {
  DocumentReference,
  DocumentReferenceContent,
  HumanName,
  Identifier,
  Resource,
} from "@medplum/fhirtypes";
import { HumanName as CWHumanName, Contained, DocumentIdentifier } from "@metriport/commonwell-sdk";
import dayjs from "dayjs";
import isToday from "dayjs/plugin/isToday";
import { MedicalDataSourceOid } from "../..";
import { Organization } from "../../../models/medical/organization";
import { Patient } from "../../../models/medical/patient";
import { CWDocumentWithMetriportData } from "../../commonwell/document/shared";
import { cwExtension } from "../../commonwell/extension";
import { ResourceType } from "../shared";
import { metriportDataSourceExtension } from "../shared/extensions/metriport";
dayjs.extend(isToday);

export const MAX_FHIR_DOC_ID_LENGTH = 64;

// HIEs probably don't have records before the year 1800 :)
const earliestPossibleYear = 1800;

function getBestDateFromCWDocRef(doc: CWDocumentWithMetriportData): string {
  const date = dayjs(doc.content?.indexed);

  // if the timestamp from CW for the indexed date is from today, this usually
  // means that the timestamp is auto-generated, and there may be a more accurate
  // timestamp in the doc ref.
  if (date.isToday() && doc.content?.context?.period?.start) {
    const newDate = dayjs(doc.content.context.period.start);

    // this check is necessary to prevent using weird dates... seen stuff like
    // this before:  "period": { "start": "0001-01-01T00:00:00Z" }
    if (newDate.year() >= earliestPossibleYear) {
      return newDate.toISOString();
    }
  }

  return date.toISOString();
}

export const toFHIR = (
  docId: string,
  doc: CWDocumentWithMetriportData,
  organization: Organization,
  patient: Patient
): DocumentReference => {
  const baseAttachment = {
    contentType: doc.content?.mimeType,
    size: doc.metriport.fileSize != null ? doc.metriport.fileSize : doc.content?.size, // can't trust the file size from CW, use what we actually saved
    creation: doc.content?.indexed,
  };

  const metriportContent = createMetriportDocReferenceContent({
    ...baseAttachment,
    fileName: doc.metriport.fileName,
    location: doc.metriport.location,
  });

  const cwContent = doc.content?.location
    ? [
        {
          attachment: {
            ...baseAttachment,
            title: doc.metriport.fileName, // no filename on CW doc refs
            url: doc.content.location,
          },
          extension: [cwExtension],
        },
      ]
    : [];

  const containedContent: Resource[] = [
    {
      resourceType: ResourceType.Patient,
      id: patient.id,
    },
  ];

  const contained = doc.content?.contained;
  if (contained?.length) {
    contained.forEach(cwResource => {
      const fhirResource = convertToFHIRResource(cwResource);
      if (fhirResource) containedContent.push(fhirResource);
    });
  }

  return {
    id: docId,
    resourceType: ResourceType.DocumentReference,
    contained: containedContent,
    masterIdentifier: {
      system: doc.content?.masterIdentifier?.system,
      value: doc.content?.masterIdentifier?.value,
    },
    identifier: doc.content?.identifier?.map(idToFHIR),
    date: getBestDateFromCWDocRef(doc),
    status: "current",
    type: doc.content?.type,
    subject: {
      reference: `Patient/${patient.id}`,
      type: ResourceType.Patient,
    },
    author: [
      {
        reference: `#${organization.id}`,
        type: ResourceType.Organization,
      },
    ],
    // DEFAULT TO COMMONWELL FOR NOW
    custodian: {
      id: MedicalDataSourceOid.COMMONWELL,
    },
    description: doc.content?.description,
    content: [...cwContent, metriportContent],
    extension: [cwExtension],
    context: doc.content?.context,
  };
};

export function createMetriportDocReferenceContent({
  contentType,
  size,
  fileName,
  location,
  creation,
}: {
  contentType?: string;
  size?: number;
  fileName: string;
  location: string;
  creation: string;
}): DocumentReferenceContent {
  const metriportContent: DocumentReferenceContent = {
    attachment: {
      contentType,
      size,
      creation,
      title: fileName,
      url: location,
    },
    extension: [metriportDataSourceExtension],
  };

  return metriportContent;
}

// TODO once we merge DocumentIdentifier with Identifier on CW SDK, let's move this to
// an identifier-specific file
export function idToFHIR(id: DocumentIdentifier): Identifier {
  return {
    system: id.system,
    value: id.value,
    use: id.use === "unspecified" ? undefined : id.use,
  };
}

/**
 * Takes a CW resource and converts it to a FHIR resource
 *
 * @param resource
 * @returns
 */
function convertToFHIRResource(resource: Contained): Resource | undefined {
  if (resource.resourceType === ResourceType.Patient && resource.id) {
    return {
      resourceType: ResourceType.Patient,
      id: resource.id,
    };
  } else if (resource.resourceType === ResourceType.Organization && resource.name) {
    return {
      resourceType: ResourceType.Organization,
      name: convertCWNameToString(resource.name),
    };
  } else if (resource.resourceType === ResourceType.Practitioner && resource.name) {
    return {
      resourceType: ResourceType.Practitioner,
      name: convertCWNameToHumanName(resource.name),
    };
  }
}

/**
 * Converts a CW name to a string
 *
 * @param name
 * @returns
 */
function convertCWNameToString(name: string | CWHumanName | CWHumanName[]): string | undefined {
  if (typeof name === "string") {
    return name;
  } else if (Array.isArray(name)) {
    if (name.length) {
      const names: string[] = [];
      name.forEach(n => {
        if (typeof n === "string") {
          names.push(n);
        } else if (typeof n === "object") {
          const humanNames = getHumanNamesFromObject(n).map(n => n.family);
          if (humanNames) names.push(humanNames.join(" "));
        }
      });
      return names.join(" ");
    }
  } else if (typeof name === "object") {
    return getHumanNamesFromObject(name)
      .map(n => n.family)
      .join(" ");
  }
}

/**
 * Converts a CW name to a FHIR HumanName
 *
 * @param name
 * @returns
 */
function convertCWNameToHumanName(
  name: string | CWHumanName | CWHumanName[]
): HumanName[] | undefined {
  if (typeof name === "string") {
    return [
      {
        family: name,
      },
    ];
  } else if (Array.isArray(name)) {
    if (name.length) {
      let names: HumanName[] = [];
      name.forEach(n => {
        if (typeof n === "string") {
          names.push({
            family: n,
          });
        } else if (typeof n === "object") {
          names = getHumanNamesFromObject(n);
        }
      });
    }
  } else if (typeof name === "object") {
    return getHumanNamesFromObject(name);
  }
}

/**
 * Converts a CW HumanName to a FHIR HumanName
 *
 * @param n
 * @returns
 */
function getHumanNamesFromObject(n: CWHumanName): HumanName[] {
  const names: HumanName[] = [];
  if (n.family.length) {
    for (let i = 0; i < n.family.length; i++) {
      names.push({
        family: n.family[i],
        given: n.given && n.given[i] ? [n.given[i]] : undefined,
        prefix: n.prefix && n.prefix[i] ? [n.prefix[i]] : undefined,
      });
    }
  }
  return names;
}
