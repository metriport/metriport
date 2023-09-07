import {
  Address,
  Device,
  DocumentReference,
  DocumentReferenceContent,
  HumanName,
  Identifier,
  Organization,
  Patient as PatientFHIR,
  Practitioner,
  PractitionerRole,
  Reference,
  RelatedPerson,
  Resource,
} from "@medplum/fhirtypes";
import {
  Contained,
  DocumentContent,
  DocumentIdentifier as CWDocumentIdentifier,
  DocumentIdentifier,
  GenderCodes,
  HumanName as CWHumanName,
} from "@metriport/commonwell-sdk";
import { Gender } from "@metriport/commonwell-sdk/src/models/demographics";
import dayjs from "dayjs";
import isToday from "dayjs/plugin/isToday";
import { MedicalDataSourceOid } from "../..";
import { joinName, Patient, splitName } from "../../../models/medical/patient";
import { capture } from "../../../shared/notifications";
import { CWDocumentWithMetriportData } from "../../commonwell/document/shared";
import { cwExtension } from "../../commonwell/extension";
import { metriportDataSourceExtension } from "../shared/extensions/metriport";
dayjs.extend(isToday);

export const MAX_FHIR_DOC_ID_LENGTH = 64;

type AuthorTypes =
  | Device
  | Organization
  | PatientFHIR
  | Practitioner
  | PractitionerRole
  | RelatedPerson;
const authorTypesMap: Record<AuthorTypes["resourceType"], AuthorTypes["resourceType"]> = {
  Device: "Device",
  Organization: "Organization",
  Patient: "Patient",
  Practitioner: "Practitioner",
  PractitionerRole: "PractitionerRole",
  RelatedPerson: "RelatedPerson",
};
const authorTypes = Object.values(authorTypesMap);

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

  // https://www.hl7.org/fhir/R4/domainresource-definitions.html#DomainResource.contained
  const containedContent: Resource[] = [];

  const contained = doc.content?.contained;
  if (contained?.length) {
    contained.forEach(cwResource => {
      const fhirResource = convertToFHIRResource(cwResource, patient.id);
      if (fhirResource) containedContent.push(fhirResource);
    });
  }

  const subject: Reference<PatientFHIR> = {
    reference: `Patient/${patient.id}`,
    type: "Patient",
  };
  const author = getAuthors(doc.content, containedContent, docId);

  return {
    id: docId,
    resourceType: "DocumentReference",
    contained: containedContent,
    masterIdentifier: {
      system: doc.content?.masterIdentifier?.system,
      value: doc.content?.masterIdentifier?.value,
    },
    identifier: doc.content?.identifier?.map(idToFHIR),
    date: getBestDateFromCWDocRef(doc),
    status: "current",
    type: doc.content?.type,
    subject,
    author,
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
 * Takes a CW resource and converts it to a FHIR resource.
 *
 * @param resource CW Contained resource.
 * @param patientId Patient ID that the document is associated with.
 * @returns FHIR Resource; otherwise sends a notification to Sentry if the resource type is not handled.
 */
function convertToFHIRResource(resource: Contained, patientId: string): Resource | undefined {
  if (resource.resourceType === "Patient" && resource.id && !resource.id.includes(patientId)) {
    capture.message(`Found a Patient resource with a different ID`, {
      extra: { context: `toFHIR.convertToFHIRResource`, resource, patientId, level: "warning" },
    });
    return {
      resourceType: "Patient",
      id: resource.id,
      address: convertCWAdressToFHIR(resource.address),
      gender: convertCWGenderToFHIR(resource.gender?.coding),
      identifier: convertCWIdentifierToFHIR(resource.identifier),
      name: resource.name ? convertCWNameToHumanName(resource.name) : undefined,
    };
  } else if (resource.resourceType === "Organization" && resource.name) {
    return {
      resourceType: "Organization",
      id: resource.id ?? undefined,
      identifier: convertCWIdentifierToFHIR(resource.identifier),
      name: convertCWNameToString(resource.name),
      address: convertCWAdressToFHIR(resource.address),
    };
  } else if (resource.resourceType === "Practitioner" && resource.name) {
    return {
      resourceType: "Practitioner",
      id: resource.id ?? undefined,
      identifier: convertCWIdentifierToFHIR(resource.identifier),
      name: convertCWNameToHumanName(resource.name),
      gender: convertCWGenderToFHIR(resource.gender?.coding),
    };
  } else {
    capture.message(
      `New Resource type on toFHIR conversion - might need to handle in CW doc ref mapping`,
      {
        extra: {
          context: `toFHIR.convertToFHIRResource`,
          resourceType: resource.resourceType,
          resource,
          patientId,
        },
      }
    );
  }
}

/**
 * Converts a CW name to a string.
 *
 * @param name One of the CW name types.
 * @returns a space-separated name string; otherwise undefined if a valid name cannot be determined.
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
 * Converts a CW name to a FHIR HumanName.
 *
 * @param name One of the CW name types.
 * @returns FHIR-compliant HumanName[]; otherwise undefined if a valid name cannot be determined.
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
      return names;
    }
  } else if (typeof name === "object") {
    return getHumanNamesFromObject(name);
  }
}

/**
 * Converts a CW HumanName to a FHIR HumanName.
 *
 * @param name CW HumanName.
 * @returns FHIR-compliant HumanName[]; otherwise undefined if a valid name cannot be determined.
 */
function getHumanNamesFromObject(name: CWHumanName): HumanName[] {
  const names: HumanName[] = [];
  if (name.use === "unspecified") return names;

  const namePrefix = getHumanNameAttribute(name.prefix);
  const nameSuffix = getHumanNameAttribute(name.suffix);

  names.push({
    family: joinName(name.family),
    given: name.given,
    prefix: namePrefix,
    suffix: nameSuffix,
    text: name.text ?? undefined,
  });
  return names;
}

/**
 * Converts a CW Document Identifier to a FHIR Identifier.
 *
 * @param identifier CW Document Identifier.
 * @returns FHIR-compliant Identifier[]; otherwise undefined if a valid identifier cannot be determined.
 */
function convertCWIdentifierToFHIR(
  identifier: CWDocumentIdentifier[] | null | undefined
): Identifier[] | undefined {
  if (identifier) {
    return identifier.map(id => ({
      use: id.use !== "unspecified" ? id.use : undefined,
      system: id.system,
      value: id.value,
    }));
  }
}

/**
 * Get the authors from content that match the contained resources.
 *
 * @param content CW DocumentContent containing the doc ref's data coming from CW.
 * @param contained FHIR-compliant resources built from CW resources.
 * @returns FHIR References to be used as authors to the document reference.
 */
export function getAuthors(
  content: DocumentContent,
  contained: Resource[],
  docId: string
): Reference<AuthorTypes>[] {
  const refs = (content.author ?? []).flatMap(author => {
    if (
      author.reference &&
      typeof author.reference === "string" &&
      author.reference.startsWith("#")
    ) {
      return author.reference.substring(1);
    }
    if (author.reference) {
      // https://hl7.org/fhir/R4/references-definitions.html#Reference.reference
      capture.message(`Found an author reference that is not internal`, {
        extra: { author, docId, context: `toFHIR.getAuthors` },
        level: "warning",
      });
    }
    return author.reference ?? [];
  });

  const authorTypesAsStr = authorTypes.map(a => a.toString());
  const containedAuthors = contained
    .filter(c => authorTypesAsStr.includes(c.resourceType))
    .filter(r => r.id && refs.includes(r.id));

  return containedAuthors.map(a => ({
    reference: `#${a.id}`,
    type: a.resourceType,
  }));
}

/**
 * Gets a CW HumanName attribute and returns it as a string[].
 * Works with prefix and suffix.
 *
 * @param attribute CW HumanName attribute.
 * @returns FHIR-compliant HumanName[].
 */
function getHumanNameAttribute(
  attribute: string | string[] | null | undefined
): string[] | undefined {
  let nameAttribute: string[] | undefined;
  if (attribute) {
    nameAttribute = typeof attribute === "string" ? splitName(attribute) : attribute;
  }
  return nameAttribute;
}

/**
 * Converts a CW Address to a FHIR Address.
 *
 * @param address CW Address.
 * @returns FHIR-compliant Address[]; otherwise undefined if a valid address cannot be determined.
 */
function convertCWAdressToFHIR(address: Contained["address"] | undefined): Address[] | undefined {
  if (address) {
    const fhirAddress: Address[] = address.map(a => {
      return {
        line: a.line ?? undefined,
        city: a.city ?? undefined,
        state: a.state ?? undefined,
        postalCode: a.zip ?? undefined,
        country: a.country ?? undefined,
        period: a.period ?? undefined,
        use:
          a.use == "home" ||
          a.use == "work" ||
          a.use == "temp" ||
          a.use == "old" ||
          a.use == "billing"
            ? a.use
            : undefined,
      };
    });

    return fhirAddress;
  }
}

/**
 * Converts a CW gender code to a FHIR gender type.
 *
 * @param genders CW gender code.
 * @returns FHIR-compliant gender string; otherwise undefined if a valid gender cannot be determined.
 */
function convertCWGenderToFHIR(genders: Gender[] | null | undefined): PatientFHIR["gender"] {
  if (genders && genders[0]) {
    switch (genders[0].code) {
      case GenderCodes.M:
        return "male";
      case GenderCodes.F:
        return "female";
      case GenderCodes.UN:
        return "other";
      case GenderCodes.UNK:
        return "unknown";
    }
  }
  return undefined;
}
